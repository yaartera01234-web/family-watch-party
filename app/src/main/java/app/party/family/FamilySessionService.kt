package app.party.family

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.*

/** User-started media session only. No boot receiver, alarms, sticky restart or background launch. */
class FamilySessionService : Service() {
    private var wake: PowerManager.WakeLock? = null
    override fun onBind(intent: Intent?) = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == CLOSE) { closeTask(); return START_NOT_STICKY }
        if (intent?.action != START || closeSession == null) { stopSelf(); return START_NOT_STICKY }
        val manager=getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL,"Family movie session",NotificationManager.IMPORTANCE_LOW))
        val open=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val close=PendingIntent.getService(this,1,Intent(this,FamilySessionService::class.java).setAction(CLOSE),PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification=Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_media_pause)
            .setContentTitle("Family Watch Party").setContentText("Lock pauses playback, keeps buffer and room. Swipe app away to close.")
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
            .addAction(Notification.Action.Builder(null,"Close session",close).build()).build()
        if (Build.VERSION.SDK_INT>=29) startForeground(41,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        else startForeground(41,notification)
        if (wake==null) wake=(getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"family:movie-session").apply { setReferenceCounted(false); acquire() }
        return START_NOT_STICKY
    }
    override fun onTaskRemoved(rootIntent: Intent?) { closeTask() }
    private fun closeTask() {
        getSharedPreferences("family-resume",MODE_PRIVATE).edit().remove("task").remove("session").commit()
        val close=closeSession
        releaseWake()
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
        if (close!=null) close() else android.os.Process.killProcess(android.os.Process.myPid())
    }
    private fun releaseWake() { wake?.let { if(it.isHeld) it.release() };wake=null }
    override fun onDestroy() {
        releaseWake()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
    companion object {
        const val START="app.party.family.START_SESSION"
        const val CLOSE="app.party.family.CLOSE_SESSION"
        private const val CHANNEL="family-movie-session"
        var closeSession: (() -> Unit)? = null
    }
}
