/**
 * Shared inspirational quotes for AnalyzeOps loading screens.
 * The random selection happens ONCE at module load time,
 * so both SplashScreen and AuthLoadingScreen always show the same quote.
 */

const QUOTES = [
    {
        text: 'Lo que no se define no se puede medir.\nLo que no se mide, no se puede mejorar.\nLo que no se mejora, se degrada siempre.',
        author: 'Lord Kelvin',
        authorFull: 'William Thomson',
    },
    {
        text: 'What gets measured gets managed.',
        sub: 'Lo que se mide, se gestiona.',
        author: 'Peter Drucker',
    },
];

// Pick ONE random quote at module load — shared across all consumers
export const selectedQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
export default QUOTES;
