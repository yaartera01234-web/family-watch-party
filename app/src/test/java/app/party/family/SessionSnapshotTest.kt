package app.party.family

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test

class SessionSnapshotTest {
    private fun data() = JSONObject("""{"name":" Family ","room":" Movie ","tower":1,"independent":true,"quality":720,"aspect":3,"muted":true,"duration":7200,"displayTitle":"Saved movie","model":{"epoch":[9,"peer"],"queue":[{"id":"movie","url":"https://example.com/movie.mp4","title":"Movie"}],"current":"movie","pos":611.5,"playing":true,"kind":"select"}}""")
    @Test fun restoresOnlyPausedBoundedLocalData() {
        val s=SessionSnapshot.sanitize(data())!!
        assertEquals("Family",s.getString("name")); assertEquals("Movie",s.getString("room")); assertTrue(s.getBoolean("independent"))
        assertFalse(s.getJSONObject("model").getBoolean("playing"))
        assertEquals(611.5,s.getJSONObject("model").getDouble("pos"),0.0)
        assertEquals(720,s.getInt("quality"));assertEquals(3,s.getInt("aspect"));assertTrue(s.getBoolean("muted"))
        assertEquals("Saved movie",s.getString("displayTitle"))
        assertEquals(s.toString(),SessionSnapshot.sanitize(s)!!.toString())
        val legacy=data();legacy.remove("independent");assertFalse(SessionSnapshot.sanitize(legacy)!!.getBoolean("independent"))
    }
    @Test fun emptyRoomIsAValidPausedSession() {
        val s=data();s.getJSONObject("model").put("queue",JSONArray()).put("current",JSONObject.NULL)
        assertNotNull(SessionSnapshot.sanitize(s))
    }
    @Test fun rejectsInvalidIdentitySourceAndRevision() {
        assertNull(SessionSnapshot.sanitize(data().put("name","")))
        assertNull(SessionSnapshot.sanitize(data().put("room","x".repeat(21))))
        assertNull(SessionSnapshot.sanitize(data().put("tower",3)))
        for(url in listOf("file:///private","javascript:alert(1)","https://","https://example.com/\nfoo")) {
            val s=data();s.getJSONObject("model").getJSONArray("queue").getJSONObject(0).put("url",url)
            assertNull(url,SessionSnapshot.sanitize(s))
        }
        for(epoch in listOf(JSONArray("[-1,\"x\"]"),JSONArray("[1.5,\"x\"]"),JSONArray("[1000000000000,\"x\"]"))) {
            val s=data();s.getJSONObject("model").put("epoch",epoch);assertNull(SessionSnapshot.sanitize(s))
        }
        for(pos in listOf(-1.0,100000001.0)) { val s=data();s.getJSONObject("model").put("pos",pos);assertNull(SessionSnapshot.sanitize(s)) }
        val missing=data();missing.getJSONObject("model").put("current","absent");assertNull(SessionSnapshot.sanitize(missing))
    }
    @Test fun rejectsDuplicateAndOversizedQueues() {
        val s=data();val q=s.getJSONObject("model").getJSONArray("queue");q.put(q.getJSONObject(0));assertNull(SessionSnapshot.sanitize(s))
        val large=data();val a=JSONArray();for(i in 0..50)a.put(JSONObject().put("id","$i").put("url","https://example.com/m.mp4").put("title","M"))
        large.getJSONObject("model").put("queue",a).put("current","0");assertNull(SessionSnapshot.sanitize(large))
    }
    @Test fun dropsUnknownFieldsAndClampsPreferences() {
        val s=data().put("quality",999).put("aspect",99).put("secret","unused").put("duration",-1).put("displayTitle","x".repeat(200))
        val out=SessionSnapshot.sanitize(s)!!;assertFalse(out.has("secret"));assertTrue(out.getBoolean("independent"));assertEquals(144,out.getInt("quality"));assertEquals(5,out.getInt("aspect"));assertEquals(0.0,out.getDouble("duration"),0.0);assertEquals(160,out.getString("displayTitle").length)
    }
}
