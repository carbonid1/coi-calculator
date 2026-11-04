# Mine Storage Control

Pause a Mine control tower when one storage reaches its upper limit. Resume it
when another storage falls to its lower limit. Requires Captain of Industry
0.8.8 (Update 4.3).

Open **Mod Settings → Mine Storage Control → New rule**. Give the tower and
storages unique names in game, then select them by name. **Pause** and **Resume**
each watch one exact container, including containers connected to other storages.
The same container can be selected for both.

Defaults: **pause at 90%**, **resume at 10%**. Mining resumes only once the resume
container reaches its lower limit and the pause container is below its upper
limit. Leave room for deliveries already on their way.

One rule controls each tower. Several towers can watch the same containers.
Rules and waiting state are saved with the factory. Changing a tower's pause
state manually turns its rule off. Disabling or deleting a rule leaves the tower
in its current pause state. A missing container or changed product suspends the
rule's decisions.

Existing storage-group rules keep watching their combined inventory. Editing
one replaces the group with the two selected containers.

Build with `powershell -ExecutionPolicy Bypass -File scripts/build-mine-storage-control.ps1`.
Add `-Test` to run regressions, `-Install` to install locally, or `-Package` to
create an installable archive. Enable the mod when loading a save.
