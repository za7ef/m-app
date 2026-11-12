package expo.modules.mtorrent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

// Keeps the app process alive while downloads run in the background (Android may otherwise freeze or kill it),
// and shows their progress. Started/updated/stopped from JS through MTorrentModule.
class DownloadService : Service() {
  companion object {
    const val CHANNEL = "m-downloads"
    const val NOTIF_ID = 4107
    @Volatile var running = false

    fun build(ctx: Context, title: String, text: String, percent: Int): Notification {
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Downloads", NotificationManager.IMPORTANCE_LOW))
      }
      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      val pi = if (launch != null) PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) else null
      @Suppress("DEPRECATION")
      val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else Notification.Builder(ctx)
      b.setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle(title)
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setProgress(100, percent.coerceIn(0, 100), percent < 0)
      if (pi != null) b.setContentIntent(pi)
      return b.build()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val n = build(this, intent?.getStringExtra("title") ?: "", intent?.getStringExtra("text") ?: "", intent?.getIntExtra("percent", -1) ?: -1)
    try {
      if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      else startForeground(NOTIF_ID, n)
      running = true
    } catch (e: Exception) {
      running = false
      stopSelf()
    }
    return START_NOT_STICKY
  }

  // Android 15+ limits dataSync services to 6 h a day; stop cleanly when told the time is up.
  override fun onTimeout(startId: Int, fgsType: Int) {
    running = false
    stopSelf()
  }

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }
}
