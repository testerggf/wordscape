from dataclasses import dataclass

from wordfreq import word_frequency

from app.utils.vocab import clean_word, infer_topic


@dataclass(frozen=True)
class ProcessedWord:
    word: str
    frequency_rank: int
    topic: str


class VocabProcessor:
    def process(self, raw_words: list[str]) -> list[ProcessedWord]:
        seen: set[str] = set()
        processed: list[ProcessedWord] = []

        for raw_word in raw_words:
            word = clean_word(raw_word)
            if not word or word in seen:
                continue
            seen.add(word)
            processed.append(ProcessedWord(
                word=word,
                frequency_rank=self._frequency_rank(word),
                topic=infer_topic(word),
            ))

        return sorted(processed, key=lambda item: item.frequency_rank, reverse=True)

    def _frequency_rank(self, word: str) -> int:
        frequency = word_frequency(word, "en")
        if frequency >= 1e-4:
            return 5
        if frequency >= 1e-5:
            return 4
        if frequency >= 1e-6:
            return 3
        if frequency >= 1e-7:
            return 2
        return 1
