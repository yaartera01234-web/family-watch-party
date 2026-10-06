package app.party.family

import org.junit.Assert.*
import org.junit.Test

class ShutdownScopeTest {
    @Test fun acceptsOnlyOurProcessGroup() { assertEquals(234, ShutdownScope.ownedGroupPid("234 (app.party.family) S 1 234 234 0",234)) }
    @Test fun rejectsSharedOrAnotherGroup() { assertNull(ShutdownScope.ownedGroupPid("234 (app.party.family) S 1 123 123 0",234)) }
    @Test fun parenthesizedProcessNameIsSafe() { assertEquals(234, ShutdownScope.ownedGroupPid("234 (name (with spaces)) S 1 234 234 0",234)) }
    @Test fun failsClosedForInvalidData() {
        for (s in listOf("", "234 malformed", "234 (app) S", "234 (app) S 1 bad 0", "234 (app) S 1 0 0", "234 (app) S 1 -234 0")) assertNull(ShutdownScope.ownedGroupPid(s,234))
        assertNull(ShutdownScope.ownedGroupPid("0 (app) S 1 0 0",0))
    }
}
