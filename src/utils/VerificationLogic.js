export const verifySpelling = (input, correct) => {
    return input.trim().toLowerCase() === correct.trim().toLowerCase();
};

export const calculateSimilarity = (input, correct) => {
    const clean = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

    const inputWords = clean(input);
    const correctWords = clean(correct);

    if (inputWords.length === 0 || correctWords.length === 0) return 0;

    const intersection = inputWords.filter(word => correctWords.includes(word));
    const union = new Set([...inputWords, ...correctWords]);

    return (intersection.length / correctWords.length) * 100;
};

export const isMeaningCorrect = (input, correct) => {
    const similarity = calculateSimilarity(input, correct);
    return similarity >= 60; // 60% threshold for "similar enough"
};
