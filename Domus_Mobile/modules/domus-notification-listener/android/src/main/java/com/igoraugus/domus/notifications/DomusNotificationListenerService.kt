package com.igoraugus.domus.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

class DomusNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    captureNotification(sbn)
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    // Recupera somente notificações ainda visíveis. Não consulta histórico do
    // Android e, portanto, não recupera notificações já dispensadas.
    activeNotifications?.forEach(::captureNotification)
  }

  private fun captureNotification(sbn: StatusBarNotification) {
    val prefs = getSharedPreferences(DomusNotificationListenerModule.PREFS, 0)
    if (!prefs.getBoolean(DomusNotificationListenerModule.KEY_CAPTURE_ENABLED, false)) return

    val packageName = sbn.packageName
    val monitored = prefs.getStringSet(DomusNotificationListenerModule.KEY_PACKAGES, emptySet()) ?: emptySet()
    val isSimulator = packageName == applicationContext.packageName
    val isWhatsApp = packageName == WHATSAPP_PACKAGE
    val testMode = prefs.getBoolean(DomusNotificationListenerModule.KEY_TEST_MODE, false)

    if (isSimulator && (!testMode || !monitored.contains(SIMULATOR_PACKAGE))) return
    if (!isSimulator && !monitored.contains(packageName)) return

    val extras = sbn.notification.extras
    val title = extras?.getCharSequence("android.title")?.toString()?.trim().orEmpty()
    val text = extras?.getCharSequence("android.text")?.toString()?.trim().orEmpty()
    if (title.isBlank() && text.isBlank()) return

    // WhatsApp só pode entrar na fila se for uma mensagem explicitamente criada
    // para o laboratório. Isso impede que conversas pessoais sejam armazenadas.
    if (isWhatsApp && (!testMode || !TEST_MARKER.containsMatchIn("$title $text"))) return

    val simulated = isSimulator
    appendEvent(prefs, JSONObject().apply {
      put("id", "${packageName}:${sbn.key}:${sbn.postTime}")
      put("packageName", packageName)
      put("title", title)
      put("text", text)
      put("postedAt", sbn.postTime)
      put("simulated", simulated)
    })
  }

  private fun appendEvent(prefs: android.content.SharedPreferences, event: JSONObject) {
    val current = JSONArray(prefs.getString(DomusNotificationListenerModule.KEY_EVENTS, "[]") ?: "[]")
    for (index in 0 until current.length()) {
      if (current.optJSONObject(index)?.optString("id") == event.optString("id")) return
    }
    if (current.length() >= 100) current.remove(0)
    current.put(event)
    prefs.edit().putString(DomusNotificationListenerModule.KEY_EVENTS, current.toString()).apply()
  }

  companion object {
    const val WHATSAPP_PACKAGE = "com.whatsapp"
    const val SIMULATOR_PACKAGE = "domus.simulator"
    private val TEST_MARKER = Regex("\\[DOMUS[- ]TESTE\\]", RegexOption.IGNORE_CASE)
  }
}
