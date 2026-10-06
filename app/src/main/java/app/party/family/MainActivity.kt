package app.party.family

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.media.AudioManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.net.Uri
import android.os.*
import android.view.*
import android.webkit.*
import android.widget.FrameLayout
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import kotlin.system.exitProcess

/** One foreground Activity. No service, background WebView, receiver, worker or restart path. */
class MainActivity : Activity() {
    private lateinit var root: FrameLayout
    private lateinit var web: WebView
    private var player: MpvVideoPlayer? = null
    private val main = Handler(Looper.getMainLooper())
    private val resolver = Executors.newSingleThreadExecutor()
    private var resolveTask: Future<*>? = null
    @Volatile private var foreground = false
    private var closed = false
    private var joined = false
    private var loadGeneration = 0L
    private var mediaId = ""
    private var pending = false
    private var requestedPlaying = false
    private var requestedPosition = 0.0
    private var muted = false
    private var loadStarted = 0L
    private var title = ""
    private var qualities = listOf<Int>()
    private var actualQuality = 0
    private var photoCallback: ValueCallback<Array<Uri>>? = null
    private var photoPending = false
    private val gestures by lazy { PlayerGestures(this, audio) { state -> emit("window.familyGestureLevel&&window.familyGestureLevel($state)") } }
    private var focusHeld = false
    private var focusRequested = false
    private val audio by lazy { getSystemService(AUDIO_SERVICE) as AudioManager }
    private val audioFocus by lazy {
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
            .setOnAudioFocusChangeListener({ change ->
                if (change < 0 && !closed) {
                    focusHeld = false; requestedPlaying = false; player?.pause()
                    emit("window.familyAudioFocusLost&&window.familyAudioFocusLost()")
                }
            }, main).build()
    }
    private fun acquireFocus(): Boolean {
        if (focusHeld) return true
        focusRequested = true
        focusHeld = audio.requestAudioFocus(audioFocus) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        return focusHeld
    }
    private fun releaseFocus() { if (focusRequested) audio.abandonAudioFocusRequest(audioFocus); focusHeld = false; focusRequested = false }


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        setContentView(root)
        web = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mediaPlaybackRequiresUserGesture = true
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            addJavascriptInterface(FamilyBridge(), "FamilyNative")
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?) = true
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val u = request?.url?.toString().orEmpty()
                    // No remote page/scripts/images/update checks. WebSocket broker transport is separate.
                    if (u.startsWith("file:///android_asset/") || u.startsWith("data:")) return null
                    return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(byteArrayOf()))
                }
                override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                    fullStop(); finishAndRemoveTask(); killOwnProcess(); return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(view: WebView?, callback: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                    // Avatar picker only on the joining screen. Never keep a joined room alive behind it.
                    if (joined || closed) { callback?.onReceiveValue(null); return true }
                    photoCallback?.onReceiveValue(null); photoCallback = callback
                    return try {
                        photoPending = true
                        startActivityForResult(Intent(Intent.ACTION_GET_CONTENT).apply { type = "image/*"; addCategory(Intent.CATEGORY_OPENABLE) }, 501)
                        true
                    } catch (_: Throwable) { photoPending = false; callback?.onReceiveValue(null); photoCallback = null; true }
                }
                override fun onPermissionRequest(request: PermissionRequest?) { request?.deny() }
            }
        }
        root.addView(web, FrameLayout.LayoutParams(-1, -1))
        YtAudioSource.ensureInit(applicationContext)
        immersive()
        web.loadUrl("file:///android_asset/index.html")
    }
    private fun immersive() {
        // Same full-width cutout policy as the original native fullscreen player.
        // Extend the surface/window, not the video's aspect ratio or crop.
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = if (!joined) WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT
                else if (Build.VERSION.SDK_INT >= 30)
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                else WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        if (Build.VERSION.SDK_INT >= 30) window.setDecorFitsSystemWindows(!joined)
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
        if (Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.hide(WindowInsets.Type.systemBars())
            window.insetsController?.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
    override fun onResume() {
        super.onResume()
        if (closed) { finishAndRemoveTask(); killOwnProcess(); return }
        foreground = true
        web.onResume(); web.resumeTimers(); immersive()
        main.removeCallbacks(ticker); main.post(ticker)
    }
    override fun onPause() {
        foreground = false
        main.removeCallbacks(ticker)
        // No media/room exists during avatar picking; only an inert paused joining UI is retained.
        if (photoPending && !joined) { web.onPause(); web.pauseTimers() }
        else { fullStop(); finishAndRemoveTask() }
        super.onPause()
    }
    override fun onStop() {
        super.onStop()
        if (!photoPending) { fullStop(); killOwnProcess() }
    }
    override fun onDestroy() { fullStop(); super.onDestroy() }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 501) {
            photoPending = false
            photoCallback?.onReceiveValue(if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null)
            photoCallback = null
        }
    }
    private fun fullStop() {
        if (closed) return
        closed = true; foreground = false; joined = false; pending = false; loadGeneration++
        // Bounded shutdown only, never a restart timer/service. Even a stuck native destroy
        // cannot keep this app/its decoder or extractor children alive after leaving.
        Thread({ SystemClock.sleep(450); forceTerminateProcess() }, "family-exit").apply { isDaemon = true; start() }
        main.removeCallbacksAndMessages(null)
        resolveTask?.cancel(true); YtAudioSource.cancelAll(); resolver.shutdownNow(); YtAudioSource.shutdown()
        player?.destroy(); player = null; releaseFocus()
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (::web.isInitialized) {
            // Destroying the document terminates MQTT sockets/reconnect timers, not just UI visibility.
            try { web.removeJavascriptInterface("FamilyNative"); web.stopLoading(); web.loadUrl("about:blank"); web.onPause(); web.pauseTimers(); root.removeView(web); web.destroy() } catch (_: Throwable) {}
        }
        photoCallback?.onReceiveValue(null); photoCallback = null
    }
    private fun killOwnProcess() {
        // Wait briefly for interrupted yt-dlp execute() to destroy its child before terminating this app.
        try { resolver.awaitTermination(300, TimeUnit.MILLISECONDS) } catch (_: Throwable) {}
        YtAudioSource.cancelAll()
        forceTerminateProcess()
    }
    private fun forceTerminateProcess() {
        val ownPid = android.os.Process.myPid()
        val ownUid = android.os.Process.myUid()
        // yt-dlp may spawn QuickJS. Kill only this package UID's children, never another app.
        try {
            java.io.File("/proc").listFiles()?.forEach { entry ->
                val pid = entry.name.toIntOrNull() ?: return@forEach
                if (pid != ownPid) try {
                    val uidLine = java.io.File(entry, "status").readLines().firstOrNull { it.startsWith("Uid:") }
                    val uid = uidLine?.substringAfter(":")?.trim()?.split(Regex("\\s+"))?.firstOrNull()?.toIntOrNull()
                    if (uid == ownUid) android.os.Process.killProcess(pid)
                } catch (_: Throwable) {}
            }
        } catch (_: Throwable) {}
        // Zygote normally gives an app its own process group. Guard ownership before group kill.
        try {
            val ownGroup = ShutdownScope.ownedGroupPid(java.io.File("/proc/self/stat").readText(), ownPid)
            if (ownGroup != null) android.system.Os.kill(-ownGroup, android.system.OsConstants.SIGKILL)
        } catch (_: Throwable) {}
        android.os.Process.killProcess(ownPid)
        exitProcess(0)
    }
    @Deprecated("Activity back dispatch")
    override fun onBackPressed() {
        if (joined && !closed) emit("window.familyBack&&window.familyBack()")
        else { fullStop(); finishAndRemoveTask(); killOwnProcess() }
    }
    private fun emit(js: String) { if (foreground && !closed && ::web.isInitialized) web.evaluateJavascript(js, null) }
    private fun error(message: String) {
        pending = false
        emit("window.familyError&&window.familyError(${JSONObject.quote(message)})")
    }
    private fun stopMedia() {
        loadGeneration++; resolveTask?.cancel(true); YtAudioSource.cancelAll()
        pending = false; requestedPlaying = false; mediaId = ""; title = ""; actualQuality = 0
        player?.destroy(); player = null; releaseFocus()
    }
    private fun command(o: JSONObject) {
        if (!foreground || closed) return
        when (o.optString("action")) {
            "join" -> { (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(web.windowToken, 0); joined = true; gestures.enter(); window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); immersive() }
            "leave" -> { joined = false; gestures.leave(); stopMedia(); window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED; immersive() }
            "gestureBegin" -> if (joined) gestures.begin(o.optLong("id",-1),o.optString("kind"))
            "gestureMove" -> if (joined) gestures.move(o.optLong("id",-1),o.optDouble("delta",Double.NaN))
            "gestureEnd" -> if (joined) gestures.end(o.optLong("id",-1))
            "rotate" -> { requestedOrientation = if (resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE) ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT else ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE; immersive() }
            "load" -> if (joined) load(o)
            "stop" -> stopMedia()
            "pause" -> { requestedPlaying = false; player?.pause() }
            "resume" -> if (joined) { if (acquireFocus()) { requestedPlaying = true; if (!pending) player?.resume() } else error("Audio busy hai. Retry karo.") }
            "seek" -> { val p=o.optDouble("position",0.0); if (p.isFinite() && p in 0.0..1e8) { requestedPosition=p; if (!pending) player?.seekTo(p) } }
            "mute" -> { muted=o.optBoolean("muted"); player?.setMuted(muted) }
            "aspect" -> player?.setAspect(o.optInt("index",0))
            "speed" -> player?.setSyncSpeed(o.optDouble("speed",1.0))
            "audio" -> player?.selectAudio(o.optInt("id",-1)) { ok -> if (!ok) emit("window.familyToast&&window.familyToast(\"Audio track nahi badla.\")") }
        }
    }
    private fun load(o: JSONObject) {
        if (!acquireFocus()) { error("Audio busy hai. Retry karo."); return }
        val url = o.optString("url").trim()
        val uri = try { Uri.parse(url) } catch (_: Throwable) { return }
        if (url.length > 8192 || uri.scheme !in listOf("http", "https") || uri.host.isNullOrBlank()) { error("Sahi video link likho."); return }
        resolveTask?.cancel(true); YtAudioSource.cancelAll()
        val ticket = ++loadGeneration
        mediaId = o.optString("id").take(160); requestedPosition = o.optDouble("position",0.0).let { if(it.isFinite()) it.coerceIn(0.0,1e8) else 0.0 }
        requestedPlaying = o.optBoolean("playing",true)
        pending = true; loadStarted = SystemClock.elapsedRealtime(); title = o.optString("title").take(160); qualities = emptyList(); actualQuality = 0
        player?.destroy(); player = MpvVideoPlayer(this,root).also { it.ensure() }
        val height = o.optInt("quality",144).takeIf { it in listOf(144,240,360,480,720,1080) } ?: 144
        val ytHost = uri.host.orEmpty().lowercase().let { it == "youtu.be" || it == "youtube.com" || it.endsWith(".youtube.com") }
        val yt = if (ytHost) YtAudioSource.videoIdOf(url) else null
        if (ytHost && yt == null) { error("YouTube video ka link do."); return }
        resolveTask = resolver.submit {
            val result = if (yt != null) YtAudioSource.resolve(yt, preferHeight=height) else YtAudioSource.Result(url,title)
            if (Thread.currentThread().isInterrupted) return@submit
            main.post {
                if (ticket != loadGeneration || closed || !foreground || !joined) return@post
                if (result == null) { error("Video nahi chali. Retry karo ya quality badlo."); return@post }
                title = result.title ?: title; actualQuality = result.height; qualities = result.qualities
                startWhenReady(ticket,result,0)
            }
        }
    }
    private fun startWhenReady(ticket: Long, source: YtAudioSource.Result, tries: Int) {
        if (ticket != loadGeneration || !foreground || closed || !joined) return
        val p = player ?: return
        if (!p.isReady) {
            if (tries >= 150 || p.error != null) { error("Player tayyar nahi hua. Retry karo."); return }
            main.postDelayed({ startWhenReady(ticket,source,tries+1) },100); return
        }
        p.setFullscreen(true); p.show()
        p.play(source.url,requestedPosition,muted,source.audioUrl,source.userAgent,source.referer,!requestedPlaying)
    }
    private val ticker = object : Runnable {
        override fun run() {
            if (!foreground || closed) return
            val p = player
            if (pending && p?.loaded() == true) { pending = false; if (!requestedPlaying) p.pause() }
            if (pending && SystemClock.elapsedRealtime()-loadStarted > 90_000) { resolveTask?.cancel(true); YtAudioSource.cancelAll(); p?.stop(); error("Video nahi chali. Retry karo.") }
            if (joined) {
                val tracks=JSONArray();p?.audioTracks()?.forEach { tracks.put(JSONObject().put("id",it.id).put("label",it.label).put("selected",it.selected)) }
                val state=JSONObject().put("id",mediaId).put("ready",p?.loaded()==true&&!pending).put("pending",pending)
                    .put("position",p?.rawPosition()?:0.0).put("duration",p?.duration()?:0.0).put("playing",p?.isPaused()==false)
                    .put("buffering",p?.buffering()==true).put("ended",p?.ended()==true).put("speed",p?.syncSpeed()?:1.0)
                    .put("title",title).put("quality",actualQuality).put("qualities",JSONArray(qualities))
                    .put("video",p?.actualHeight()?:0).put("artwork",p?.hasArtwork()==true).put("tracks",tracks)
                emit("window.familyNativeState&&window.familyNativeState($state)")
                if (p?.error != null && pending) error("Video nahi chali. Retry karo.")
            }
            main.postDelayed(this,300)
        }
    }
    private inner class FamilyBridge {
        @JavascriptInterface fun postMessage(json: String) {
            if (!foreground || closed || json.length > 65536) return
            main.post { if (foreground && !closed) try { command(JSONObject(json)) } catch (_: Throwable) { error("Dobara try karo.") } }
        }
    }
}
