package com.igoraugus.domus.notifications

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DomusNotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DomusNotificationListener")

    Function("configure") { captureEnabled: Boolean, testMode: Boolean, packages: List<String> ->
      val context = appContext.reactContext ?: return@Function
      context.getSharedPreferences(PREFS, 0).edit()
        .putBoolean(KEY_CAPTURE_ENABLED, captureEnabled)
        .putBoolean(KEY_TEST_MODE, testMode)
        .putStringSet(KEY_PACKAGES, packages.toSet())
        .apply()
    }

    Function("isConfigured") {
      val context = appContext.reactContext ?: return@Function false
      context.getSharedPreferences(PREFS, 0).getBoolean(KEY_CAPTURE_ENABLED, false)
    }

    Function("isNotificationAccessGranted") {
      val context = appContext.reactContext ?: return@Function false
      val enabledPackages = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      enabledPackages.split(":").any { it.startsWith(context.packageName ?: "") }
    }

    Function("openNotificationAccessSettings") {
      val context = appContext.reactContext ?: return@Function null
      context.startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      })
    }

    Function("requestCaptureRefresh") {
      val context = appContext.reactContext ?: return@Function null
      try {
        NotificationListenerService.requestRebind(
          ComponentName(context, DomusNotificationListenerService::class.java),
        )
      } catch (_: SecurityException) {
        // A tela mostra o estado da permissão e orienta o usuário a habilitá-la.
      }
    }

    Function("drainEvents") {
      val context = appContext.reactContext ?: return@Function emptyList<Map<String, Any>>()
      val prefs = context.getSharedPreferences(PREFS, 0)
      val json = prefs.getString(KEY_EVENTS, "[]") ?: "[]"
      prefs.edit().putString(KEY_EVENTS, "[]").apply()
      org.json.JSONArray(json).let { array ->
        (0 until array.length()).map { index ->
          val item = array.getJSONObject(index)
          mapOf(
            "id" to item.getString("id"),
            "packageName" to item.getString("packageName"),
            "title" to item.optString("title"),
            "text" to item.optString("text"),
            "postedAt" to item.getLong("postedAt"),
            "simulated" to item.optBoolean("simulated", false),
          )
        }
      }
    }
  }

  companion object {
    const val PREFS = "domus_notification_listener"
    const val KEY_CAPTURE_ENABLED = "capture_enabled"
    const val KEY_TEST_MODE = "test_mode"
    const val KEY_PACKAGES = "packages"
    const val KEY_EVENTS = "events"
  }
}
