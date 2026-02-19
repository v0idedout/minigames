// ...existing code...

// These two constants control how the trail behaves:
// - Points older than 8 seconds are deleted from memory
// - We only save a new trail point every 3 frames (to avoid saving too many)
const TRAIL_MAX_AGE = 8000; // 8000 milliseconds = 8 seconds
const TRAIL_SAMPLE_RATE = 3; // Save position every 3rd frame

// ...existing code...

function update() {
    // ...existing code...
    
    // frameCounter counts up every frame. When it reaches TRAIL_SAMPLE_RATE (3),
    // we save the player's current position to the trail array, then reset the counter.
    // This means we save a "breadcrumb" dot every 3 frames instead of every single frame.
    frameCounter++;
    if (frameCounter >= TRAIL_SAMPLE_RATE) {
        // Save the player's current X and Y position, plus the current time
        trail.push({ x: player.x, y: player.y, time: Date.now() });
        frameCounter = 0; // Reset the counter back to 0
    }
    
    // Clean up old trail points every frame.
    // Date.now() gives us the current time in milliseconds.
    const now = Date.now();
    
    // Keep only trail points that are YOUNGER than TRAIL_MAX_AGE (8 seconds).
    // Think of it like a receipt tape — old entries fall off the back end.
    const filtered = trail.filter(point => (now - point.time) < TRAIL_MAX_AGE);
    
    // If filtering removed EVERYTHING, keep at least the very last point.
    // This prevents the trail from being completely empty, which would mean
    // there's no place to respawn the player.
    trail = filtered.length > 0 ? filtered : trail.slice(-1);
    
    // ...existing code...
}

// ...existing code...

function die() {
    // justDied prevents die() from being called multiple times in the same frame
    // (e.g. if the player touches two spikes at once)
    if (justDied) return;
    justDied = true;

    // trail[0] is the OLDEST point still in the array — the furthest back the player walked.
    // Because old points expire after 8 seconds, trail[0] acts like a rolling checkpoint:
    // it's always roughly 8 seconds behind the player's current position.
    //
    // If for some reason the trail is empty (edge case), we just respawn where the player
    // already is — no punishment, no teleporting to the map origin.
    const respawnPoint = trail.length > 0
        ? trail[0]          // <- use the oldest trail point (furthest back = rolling checkpoint)
        : { x: player.x, y: player.y }; // <- fallback: stay in place

    // Move the player back to the respawn point
    player.x = respawnPoint.x;
    player.y = respawnPoint.y;

    // Reset the trail so it starts fresh from the new respawn position.
    // This is important — it means the player can't die again and be sent
    // even further back. The "clock" resets from here.
    trail = [{ x: player.x, y: player.y, time: Date.now() }];

    // Slightly adjust the camera position toward the origin (cosmetic nudge)
    camera.x -= camera.x * 0.1; camera.y -= camera.y * 0.1;

    // Play the death visual effect (red flash, shockwave rings, particles)
    // centered on where the player just respawned
    triggerRespawnFx(player.x, player.y);
}

// ...existing code...