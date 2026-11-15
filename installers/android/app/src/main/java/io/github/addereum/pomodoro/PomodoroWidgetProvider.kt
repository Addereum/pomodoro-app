package io.github.addereum.pomodoro

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

class PomodoroWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_WIDGET_TOGGLE = "io.github.addereum.pomodoro.ACTION_WIDGET_TOGGLE"
        const val ACTION_WIDGET_SKIP = "io.github.addereum.pomodoro.ACTION_WIDGET_SKIP"

        var lastPhase = "Fokus"
        var lastFormattedTime = "25:00"
        var lastIsRunning = false

        fun updateAllWidgets(
            context: Context,
            phase: String,
            formattedTime: String,
            isRunning: Boolean
        ) {
            lastPhase = phase
            lastFormattedTime = formattedTime
            lastIsRunning = isRunning

            val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
            val componentName = ComponentName(context, PomodoroWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (appWidgetIds == null || appWidgetIds.isEmpty()) return

            val views = buildRemoteViews(context, phase, formattedTime, isRunning)
            appWidgetManager.updateAppWidget(appWidgetIds, views)
        }

        private fun buildRemoteViews(
            context: Context,
            phase: String,
            formattedTime: String,
            isRunning: Boolean
        ): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_pomodoro)
            views.setTextViewText(R.id.widget_phase, phase)
            views.setTextViewText(R.id.widget_time, formattedTime)

            val toggleIcon = if (isRunning) {
                android.R.drawable.ic_media_pause
            } else {
                android.R.drawable.ic_media_play
            }
            views.setImageViewResource(R.id.widget_btn_toggle, toggleIcon)

            val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or (
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
            )

            // Klick auf Widget öffnet die App
            val openIntent = Intent(context, MainActivity::class.java).apply {
                setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val openPendingIntent = PendingIntent.getActivity(context, 0, openIntent, pendingFlags)
            views.setOnClickPendingIntent(R.id.widget_root, openPendingIntent)

            // Start / Pause
            val toggleIntent = Intent(context, PomodoroWidgetProvider::class.java).apply {
                action = ACTION_WIDGET_TOGGLE
            }
            val togglePendingIntent = PendingIntent.getBroadcast(context, 101, toggleIntent, pendingFlags)
            views.setOnClickPendingIntent(R.id.widget_btn_toggle, togglePendingIntent)

            // Überspringen
            val skipIntent = Intent(context, PomodoroWidgetProvider::class.java).apply {
                action = ACTION_WIDGET_SKIP
            }
            val skipPendingIntent = PendingIntent.getBroadcast(context, 102, skipIntent, pendingFlags)
            views.setOnClickPendingIntent(R.id.widget_btn_skip, skipPendingIntent)

            return views
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val views = buildRemoteViews(context, lastPhase, lastFormattedTime, lastIsRunning)
        for (widgetId in appWidgetIds) {
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_WIDGET_TOGGLE -> {
                if (MainActivity.isAppActive) {
                    val toggleIntent = Intent(MainActivity.ACTION_TOGGLE)
                    context.sendBroadcast(toggleIntent)
                } else {
                    val launchIntent = Intent(context, MainActivity::class.java).apply {
                        action = MainActivity.ACTION_TOGGLE
                        setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    context.startActivity(launchIntent)
                }
            }
            ACTION_WIDGET_SKIP -> {
                if (MainActivity.isAppActive) {
                    val skipIntent = Intent(MainActivity.ACTION_SKIP)
                    context.sendBroadcast(skipIntent)
                } else {
                    val launchIntent = Intent(context, MainActivity::class.java).apply {
                        action = MainActivity.ACTION_SKIP
                        setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    context.startActivity(launchIntent)
                }
            }
        }
    }
}
