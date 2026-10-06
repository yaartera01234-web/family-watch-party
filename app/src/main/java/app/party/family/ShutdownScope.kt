package app.party.family

/** Pure parsing avoids hidden Android getpgid APIs and prevents cross-app group termination. */
internal object ShutdownScope {
    fun ownedGroupPid(stat: String, ownPid: Int): Int? {
        if (ownPid <= 0 || ')' !in stat) return null
        // /proc/PID/stat: pid (comm, which may contain spaces/parentheses) state ppid pgrp ...
        val fields = stat.substringAfterLast(')').trim().split(Regex("\\s+"))
        val pgrp = fields.getOrNull(2)?.toIntOrNull() ?: return null
        return if (pgrp == ownPid) ownPid else null
    }
}
