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
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Base64
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import android.widget.Toast
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
    private val ALARM_CHANNEL_ID = "pomodoro_alarm_channel"
    private val NOTIFICATION_ID = 1001
    private val ALARM_NOTIFICATION_ID = 1002

    private val REQUEST_CODE_AUDIO = 2001
    private val REQUEST_CODE_PERMISSION_AUDIO = 2002
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    private var isPageLoaded = false
    private var pendingAction: String? = null

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
        pendingAction = intent?.action

        createNotificationChannels()
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

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                isPageLoaded = true
                pendingAction?.let {
                    handleIncomingAction(it)
                    pendingAction = null
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback
                checkAudioPermissionAndPick()
                return true
            }
        }

        // Load index.html through local asset loader
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleIncomingAction(intent?.action)
    }

    private fun handleIncomingAction(action: String?) {
        if (action == null) return
        if (!isPageLoaded) {
            pendingAction = action
            return
        }
        when (action) {
            ACTION_TOGGLE -> {
                webView.evaluateJavascript("if (window.pomodoroApp) window.pomodoroApp.timer.toggle();", null)
            }
            ACTION_SKIP -> {
                webView.evaluateJavascript("if (window.pomodoroApp) window.pomodoroApp.timer.skip();", null)
            }
        }
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

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java) ?: return

            // 1. Timer Status Channel (Low priority, persistent)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pomodoro Timer Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Aktueller Timer-Status in der Benachrichtigungsleiste"
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)

            // 2. Wecker & Alarm Channel (High priority, USAGE_ALARM)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build()
            val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val alarmChannel = NotificationChannel(
                ALARM_CHANNEL_ID,
                "Pomodoro Wecker & Alarm",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Akustischer Wecker und Alarm beim Phasenabschluss"
                setSound(alarmSound, audioAttributes)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 350, 150, 350)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(alarmChannel)
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

        // Home Screen AppWidget synchronisieren
        try {
            PomodoroWidgetProvider.updateAllWidgets(this, phaseText, formattedTime, isRunning)
        } catch (e: Exception) {
            // Ignore
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
        manager.cancel(ALARM_NOTIFICATION_ID)
        super.onDestroy()
    }

    private fun getVibrator(): Vibrator {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    fun triggerVibration(type: String) {
        try {
            val vibrator = getVibrator()
            if (!vibrator.hasVibrator()) return

            when (type) {
                "focus" -> {
                    val timings = longArrayOf(0, 350, 150, 350)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(timings, -1)
                    }
                }
                "break" -> {
                    val timings = longArrayOf(0, 500)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(timings, -1)
                    }
                }
                "click" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(25, VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        vibrator.vibrate(25)
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore vibration errors
        }
    }

    fun triggerPhaseComplete(phase: String, title: String, message: String) {
        // 1. Phasen-spezifisches Vibrationsmuster
        triggerVibration(if (phase == "focus") "focus" else "break")

        // 2. High-Priority Heads-Up Wecker Notification
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(this, ALARM_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openPendingIntent)
            .setSound(alarmSound)
            .setAutoCancel(true)

        val manager = NotificationManagerCompat.from(this)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            try {
                manager.notify(ALARM_NOTIFICATION_ID, builder.build())
            } catch (e: SecurityException) {
                // Ignore if not permitted
            }
        }
    }

    class WebAppInterface(private val activity: MainActivity) {
        @JavascriptInterface
        fun updateTimerStatus(phase: String, formattedTime: String, isRunning: Boolean) {
            activity.runOnUiThread {
                activity.updateNotification(phase, formattedTime, isRunning)
            }
        }

        @JavascriptInterface
        fun triggerPhaseComplete(phase: String, title: String, message: String) {
            activity.runOnUiThread {
                activity.triggerPhaseComplete(phase, title, message)
            }
        }

        @JavascriptInterface
        fun vibrate(type: String) {
            activity.runOnUiThread {
                activity.triggerVibration(type)
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

        @JavascriptInterface
        fun pickCustomAudioFile() {
            activity.runOnUiThread {
                activity.checkAudioPermissionAndPick()
            }
        }
    }

    fun checkAudioPermissionAndPick() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.READ_MEDIA_AUDIO), REQUEST_CODE_PERMISSION_AUDIO)
                return
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.READ_EXTERNAL_STORAGE), REQUEST_CODE_PERMISSION_AUDIO)
                return
            }
        }
        launchAudioPicker()
    }

    private fun launchAudioPicker() {
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "audio/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            startActivityForResult(Intent.createChooser(intent, "Fokus-Sound auswählen"), REQUEST_CODE_AUDIO)
        } catch (e: Exception) {
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = null
            Toast.makeText(this, "Kein Dateimanager gefunden", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CODE_PERMISSION_AUDIO) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                launchAudioPicker()
            } else {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = null
                Toast.makeText(this, "Berechtigung für Zugriff auf Audiodateien erforderlich", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_AUDIO) {
            val uri = data?.data
            if (resultCode == RESULT_OK && uri != null) {
                fileUploadCallback?.onReceiveValue(arrayOf(uri))
                fileUploadCallback = null
                processSelectedAudioUri(uri)
            } else {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = null
            }
        }
    }

    private fun processSelectedAudioUri(uri: Uri) {
        try {
            var displayName = "custom_sound.mp3"
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIndex != -1) {
                        displayName = cursor.getString(nameIndex)
                    }
                }
            }

            val inputStream = contentResolver.openInputStream(uri)
            val bytes = inputStream?.readBytes()
            inputStream?.close()

            if (bytes != null && bytes.isNotEmpty()) {
                val mimeType = contentResolver.getType(uri) ?: "audio/mpeg"
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val dataUrl = "data:$mimeType;base64,$base64"
                val safeName = displayName.replace("'", "\\'")

                runOnUiThread {
                    webView.evaluateJavascript(
                        "if (window.pomodoroApp) window.pomodoroApp.handleCustomAudioLoaded('$dataUrl', '$safeName');",
                        null
                    )
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Fehler beim Laden der Audiodatei", Toast.LENGTH_LONG).show()
        }
    }
}
