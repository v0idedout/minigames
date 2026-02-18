const splashes = [
    "play some games while you're at it.",
    "insert coin to continue.",
    "high scores only.",
    "player 1 ready.",
    "choose your destiny.",
    "avoid the red cubes!",
    "wasd to move.",
    "level up!",
    "pause for snacks.",
    "glhf.",
];

document.addEventListener('DOMContentLoaded', () => {
    const subtitle = document.getElementById('subtitle');
    if (subtitle) {
        subtitle.textContent = splashes[Math.floor(Math.random() * splashes.length)];
    }
});
