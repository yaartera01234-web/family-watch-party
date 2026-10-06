package app.party.family

import org.junit.Assert.*
import org.junit.Test

class GestureMathTest {
    @Test fun brightnessDirectionAndLimits() {
        assertEquals(.7, GestureMath.brightness(.5,.2),.00001)
        assertEquals(.3, GestureMath.brightness(.5,-.2),.00001)
        assertEquals(.05, GestureMath.brightness(.1,-2.0),.00001)
        assertEquals(1.0, GestureMath.brightness(.9,2.0),.00001)
    }
    @Test fun volumeUsesDeviceStepsAndNeverExceedsLimits() {
        assertEquals(9, GestureMath.volume(6.0,.2,15))
        assertEquals(3, GestureMath.volume(6.0,-.2,15))
        assertEquals(0, GestureMath.volume(3.0,-2.0,15))
        assertEquals(15, GestureMath.volume(12.0,2.0,15))
        assertEquals(0, GestureMath.volume(0.0,.5,0))
    }
}
