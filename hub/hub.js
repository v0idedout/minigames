// Random splash text for the header
/*
const splashes = [
    "Insert Coin to Start",
    "High Scores Only",
    "Player 1 Ready",
    "GLHF",
    "Avoid the Red Cubes!",
    "WASD to Move",
    "Choose Your Destiny",
    "Level Up!",
    "Pause for Snacks"
];

document.addEventListener('DOMContentLoaded', () => {
    const subtitle = document.querySelector('header p');
    if (subtitle) {
        const randomSplash = splashes[Math.floor(Math.random() * splashes.length)];
        subtitle.textContent = randomSplash;
    }
});
*/

document.addEventListener('DOMContentLoaded', () => {
    const subtitle = document.querySelector('header p');
    if (subtitle) {
        subtitle.textContent = "Play some games while you're at it.";
    }
});