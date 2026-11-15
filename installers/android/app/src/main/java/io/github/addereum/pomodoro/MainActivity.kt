package io.github.addereum.pomodoro

import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : Activity() {

    companion object {
        const val ACTION_TOGGLE = "io.github.addereum.pomodoro.ACTION_TOGGLE_TIMER"
        const val ACTION_SKIP = "io.github.addereum.pomodoro.ACTION_SKIP_PHASE"
        var isAppActive = false
        var isTimerRunning = false
        var currentPhaseName = "Fokus"
    }

    private lateinit var webView: WebView
    private val CHANNEL_ID = "pomodoro_timer_channel"
    private val NOTIFICATION_ID = 1001

    private val timerActionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                ACTION_TOGGLE -> {
                    webView.evaluateJavascript("if (window.pomodoroApp) window.pomodoroApp.timer.toggle();", null)
                }
                ACTION_SKIP -> {
                    webView.evaluateJavascript("if (window.pomodoroApp) window.pomodoroApp.timer.skip();", null)
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        isAppActive = true

        createNotificationChannel()
        registerTimerActions()
        requestNotificationPermission()

        webView = WebView(this)
        setContentView(webView)

        // Disable native overscroll bouncing and scrollbars
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = true
        settings.allowUniversalAccessFromFileURLs = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        // Expose Android Bridge to JavaScript
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBridge")

        // Google WebViewAssetLoader: Serves local assets via virtual HTTPS domain.
        // Resolves CORS for ES6 modules and grants offline Web Audio API access.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                return request?.url?.let { assetLoader.shouldInterceptRequest(it) }
            }
        }

        webView.webChromeClient = WebChromeClient()

        // Load index.html through local asset loader
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
    }

    private fun registerTimerActions() {
        val filter = IntentFilter().apply {
            addAction(ACTION_TOGGLE)
            addAction(ACTION_SKIP)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(timerActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(timerActionReceiver, filter)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pomodoro Timer Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Aktueller Timer-Status in der Benachrichtigungsleiste"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }
    }

    fun updateNotification(phase: String, formattedTime: String, isRunning: Boolean) {
        val phaseLabels = mapOf(
            "focus" to "Fokus",
            "shortBreak" to "Kurze Pause",
            "longBreak" to "Lange Pause"
        )
        val phaseText = phaseLabels[phase] ?: "Fokus"

        // Tap to open app
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // Notification Action: Toggle (Pause / Start)
        val toggleIntent = Intent(ACTION_TOGGLE)
        val togglePendingIntent = PendingIntent.getBroadcast(
            this, 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // Notification Action: Skip
        val skipIntent = Intent(ACTION_SKIP)
        val skipPendingIntent = PendingIntent.getBroadcast(
            this, 2, skipIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val toggleLabel = if (isRunning) "Pause" else "Fortsetzen"

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Addereums Pomodoro – $phaseText")
            .setContentText("$formattedTime verbleibend")
            .setContentIntent(openPendingIntent)
            .setOngoing(isRunning)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_play, toggleLabel, togglePendingIntent)
            .addAction(android.R.drawable.ic_media_next, "Überspringen", skipPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        val manager = NotificationManagerCompat.from(this)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            try {
                manager.notify(NOTIFICATION_ID, builder.build())
            } catch (e: SecurityException) {
                // Permission not yet granted
            }
        }

        // Quick Settings Tile synchronisieren
        isTimerRunning = isRunning
        currentPhaseName = phaseText
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                android.service.quicksettings.TileService.requestListeningState(
                    this,
                    android.content.ComponentName(this, PomodoroTileService::class.java)
                )
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    fun requestDisableBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                try {
                    startActivity(intent)
                } catch (e: Exception) {
                    val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    try {
                        startActivity(fallbackIntent)
                    } catch (e2: Exception) {
                        // Ignore
                    }
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    fun setKeepScreenOnFlag(keepOn: Boolean) {
        if (keepOn) {
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    override fun onDestroy() {
        isAppActive = false
        isTimerRunning = false
        try {
            unregisterReceiver(timerActionReceiver)
        } catch (e: Exception) {
            // Already unregistered
        }
        val manager = NotificationManagerCompat.from(this)
        manager.cancel(NOTIFICATION_ID)
        super.onDestroy()
    }

    class WebAppInterface(private val activity: MainActivity) {
        @JavascriptInterface
        fun updateTimerStatus(phase: String, formattedTime: String, isRunning: Boolean) {
            activity.runOnUiThread {
                activity.updateNotification(phase, formattedTime, isRunning)
            }
        }

        @JavascriptInterface
        fun requestBatteryOptimization() {
            activity.runOnUiThread {
                activity.requestDisableBatteryOptimization()
            }
        }

        @JavascriptInterface
        fun setKeepScreenOn(keepOn: Boolean) {
            activity.runOnUiThread {
                activity.setKeepScreenOnFlag(keepOn)
            }
        }
    }
}
