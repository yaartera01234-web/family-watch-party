package app.party.family

import android.app.Activity
import android.media.AudioManager
import android.provider.Settings
import org.json.JSONObject
import kotlin.math.roundToInt

/** Foreground-only, device-local controls. No system brightness write or room broadcast. */
internal class PlayerGestures(private val activity: Activity, private val audio: AudioManager,
                              private val report: (JSONObject) -> Unit) {
    private var previousBrightness = -1f
    private var id = -1L
    private var kind = ""
    private var start = 0.0
    fun enter() { previousBrightness = activity.window.attributes.screenBrightness; end() }
    fun leave() {
        end()
        activity.window.attributes = activity.window.attributes.apply { screenBrightness = previousBrightness }
    }
    fun end(token: Long) { if (token == id) end() }
    fun end() { id = -1L; kind = "" }
    fun begin(token: Long, type: String) {
        if (token < 0 || type !in listOf("brightness", "volume")) return
        id = token; kind = type
        start = if (kind == "brightness") {
            val windowValue = activity.window.attributes.screenBrightness
            if (windowValue >= 0f) windowValue.toDouble() else {
                val value = try { Settings.System.getInt(activity.contentResolver, Settings.System.SCREEN_BRIGHTNESS) } catch (_: Throwable) { 128 }
                (value / 255.0).coerceIn(.05, 1.0)
            }
        } else audio.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble()
        feedback()
    }
    fun move(token: Long, delta: Double) {
        if (token != id || id < 0 || !delta.isFinite() || delta !in -4.0..4.0) return
        try {
            if (kind == "brightness") {
                activity.window.attributes = activity.window.attributes.apply {
                    screenBrightness = GestureMath.brightness(start, delta).toFloat()
                }
            } else if (kind == "volume" && !audio.isVolumeFixed) {
                val target = GestureMath.volume(start, delta, audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC))
                if (target != audio.getStreamVolume(AudioManager.STREAM_MUSIC))
                    audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
            }
            feedback()
        } catch (_: SecurityException) { feedback(true) }
    }
    private fun feedback(blocked: Boolean = false) {
        if (id < 0) return
        val percent = if (kind == "brightness") (activity.window.attributes.screenBrightness.takeIf { it >= 0 }?.toDouble() ?: start).times(100).roundToInt()
        else {
            val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            if (max > 0) (100.0 * audio.getStreamVolume(AudioManager.STREAM_MUSIC) / max).roundToInt() else 0
        }
        report(JSONObject().put("id", id).put("kind", kind).put("percent", percent.coerceIn(0, 100))
            .put("blocked", blocked || (kind == "volume" && audio.isVolumeFixed)))
    }
}

internal object GestureMath {
    fun brightness(start: Double, delta: Double): Double = (start + delta).coerceIn(.05, 1.0)
    fun volume(start: Double, delta: Double, maximum: Int): Int =
        (start + delta * maximum.coerceAtLeast(0)).roundToInt().coerceIn(0, maximum.coerceAtLeast(0))
}
