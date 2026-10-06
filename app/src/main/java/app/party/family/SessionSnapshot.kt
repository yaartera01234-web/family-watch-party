package app.party.family

import org.json.JSONArray
import org.json.JSONObject

/** Local resume data only. Restoring a snapshot never restores a playing flag. */
internal object SessionSnapshot {
    fun sanitize(raw: JSONObject): JSONObject? = try {
        val name=raw.optString("name").trim(); val room=raw.optString("room").trim()
        require(name.isNotEmpty() && name.length<=20 && room.isNotEmpty() && room.length<=20)
        val tower=raw.optInt("tower",-1); require(tower in 0..2)
        val source=raw.getJSONObject("model"); val original=source.getJSONArray("queue"); require(original.length()<=50)
        val items=JSONArray(); val ids=HashSet<String>()
        for(i in 0 until original.length()) {
            val item=original.getJSONObject(i); val id=item.getString("id"); val url=item.getString("url"); val title=item.getString("title")
            require(id.isNotBlank() && id.length<=160 && ids.add(id) && title.length<=160 && url.length<=8192)
            require(!url.contains('\n') && !url.contains('\r'))
            val parsed=java.net.URL(url); require(parsed.protocol in listOf("http","https") && parsed.host.isNotBlank())
            items.put(JSONObject().put("id",id).put("url",url).put("title",title))
        }
        val current=if(source.isNull("current")) null else source.getString("current")
        require(current==null || current in ids)
        val pos=source.optDouble("pos",0.0); require(pos.isFinite() && pos in 0.0..1e8)
        val epoch=source.getJSONArray("epoch"); require(epoch.length()==2)
        val clock=epoch.getDouble(0); val actor=epoch.getString(1)
        require(clock.isFinite() && clock>=0 && clock<1e12 && clock==clock.toLong().toDouble() && actor.length<=160)
        val quality=raw.optInt("quality",144).takeIf { it in listOf(144,240,360,480,720,1080) } ?: 144
        val duration=raw.optDouble("duration",0.0).let { if(it.isFinite() && it in 0.0..1e8) it else 0.0 }
        JSONObject().put("name",name).put("room",room).put("tower",tower).put("quality",quality)
            .put("displayTitle",raw.optString("displayTitle", "").take(160)).put("aspect",raw.optInt("aspect",0).coerceIn(0,5)).put("muted",raw.optBoolean("muted",false)).put("duration",duration)
            .put("model",JSONObject().put("epoch",JSONArray().put(clock.toLong()).put(actor)).put("queue",items)
                .put("current",current ?: JSONObject.NULL).put("pos",pos).put("playing",false).put("kind","pause"))
    } catch (_: Throwable) { null }
}
