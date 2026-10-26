"""
Text generation engine for TypeSprint.
Provides customizable word streams, quotes, punctuation, and number injection.
"""

import random

# Common typing test vocabulary (curated frequent English words)
WORD_BANK = [
    "the", "be", "of", "and", "a", "to", "in", "he", "have", "it", "that", "for", "they", "with",
    "as", "not", "on", "she", "at", "by", "this", "we", "you", "do", "but", "his", "from", "they",
    "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can",
    "like", "time", "no", "just", "him", "know", "take", "people", "into", "year", "your", "good",
    "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its",
    "over", "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well",
    "way", "even", "new", "want", "because", "any", "these", "give", "day", "most", "us", "world",
    "code", "program", "speed", "focus", "flow", "mind", "learn", "react", "python", "create",
    "build", "state", "system", "quick", "smart", "swift", "sprint", "light", "space", "power",
    "great", "never", "always", "every", "begin", "future", "simple", "change", "number", "point",
    "water", "sound", "place", "little", "round", "write", "grow", "open", "walk", "drive",
    "life", "dream", "night", "river", "mountain", "forest", "sunshine", "horizon", "journey", "path",
    "signal", "screen", "keyboard", "device", "connect", "logic", "design", "solve", "memory", "cache",
    "thread", "engine", "source", "branch", "commit", "server", "stream", "packet", "buffer", "render"
]

QUOTES = [
    {"quote": "The only way to do great work is to love what you do.", "author": "Steve Jobs"},
    {"quote": "It is during our darkest moments that we must focus to see the light.", "author": "Aristotle"},
    {"quote": "Do not go where the path may lead, go instead where there is no path and leave a trail.", "author": "Ralph Waldo Emerson"},
    {"quote": "In the middle of difficulty lies opportunity.", "author": "Albert Einstein"},
    {"quote": "Simplicity is the soul of efficiency.", "author": "Austin Freeman"},
    {"quote": "First, solve the problem. Then, write the code.", "author": "John Johnson"},
    {"quote": "Experience is the name everyone gives to their mistakes.", "author": "Oscar Wilde"},
    {"quote": "Knowledge is power, but enthusiasm pulls the switch.", "author": "Ivern Ball"},
    {"quote": "Programs must be written for people to read, and only incidentally for machines to execute.", "author": "Harold Abelson"},
    {"quote": "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", "author": "Martin Fowler"}
]

PUNCTUATIONS = [".", ",", ";", "!", "?", "-", ":", '"']

def generate_words(count=25, with_punctuation=False, with_numbers=False):
    """Generate a clean, randomized list of words tailored to mode and modifiers."""
    selected_words = []
    
    # Avoid immediate repetitions
    last_word = None
    for _ in range(count):
        candidates = [w for w in WORD_BANK if w != last_word]
        word = random.choice(candidates)
        last_word = word
        selected_words.append(word)

    # Inject numbers if requested (~15% chance per word position)
    if with_numbers:
        for i in range(len(selected_words)):
            if random.random() < 0.15:
                num = str(random.choice([
                    random.randint(1, 99),
                    random.randint(100, 2026),
                    random.randint(10, 500)
                ]))
                selected_words[i] = num

    # Inject punctuation if requested
    if with_punctuation:
        formatted = []
        capitalize_next = True
        for i, word in enumerate(selected_words):
            if capitalize_next and word.isalpha():
                word = word.capitalize()
                capitalize_next = False
            
            # Chance to add punctuation at the end of word
            if i == len(selected_words) - 1:
                word += "."
            elif random.random() < 0.20:
                punct = random.choice([",", ",", ".", ";", "?", "!"])
                word += punct
                if punct in [".", "?", "!"]:
                    capitalize_next = True

            formatted.append(word)
        selected_words = formatted

    return " ".join(selected_words)

def get_quote():
    """Returns a random quote text with author."""
    q = random.choice(QUOTES)
    return f"{q['quote']} — {q['author']}"
