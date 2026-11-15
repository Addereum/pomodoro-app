package io.github.addereum.pomodoro

import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi

/**
 * Android Quick Settings Tile for Addereums Pomodoro.
 * Allows starting / pausing the timer directly from the system Quick Settings shade.
 */
@RequiresApi(Build.VERSION_CODES.N)
class PomodoroTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        updateTileState()
    }

    override fun onClick() {
        super.onClick()

        // 1. Send toggle broadcast to running app
        val toggleIntent = Intent(MainActivity.ACTION_TOGGLE)
        sendBroadcast(toggleIntent)

        // 2. If app is not open in foreground, bring it up or launch it
        if (!MainActivity.isAppActive) {
            val launchIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val pending = android.app.PendingIntent.getActivity(
                    this, 0, launchIntent,
                    android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
                )
                startActivityAndCollapse(pending)
            } else {
                @Suppress("DEPRECATION")
                startActivityAndCollapse(launchIntent)
            }
        }

        updateTileState()
    }

    private fun updateTileState() {
        val tile = qsTile ?: return
        val isRunning = MainActivity.isTimerRunning
        val phase = MainActivity.currentPhaseName

        tile.state = if (isRunning) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = "Pomodoro"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = if (isRunning) "Läuft ($phase)" else "Pausiert"
        }
        tile.updateTile()
    }
}
