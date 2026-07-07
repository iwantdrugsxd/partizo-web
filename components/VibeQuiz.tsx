"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { VIBE_QUIZ } from "@/data/quiz";
import { QuizAnswer } from "@/lib/types";

interface Props {
  onComplete: (answers: QuizAnswer[]) => void;
}

export default function VibeQuiz({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const question = VIBE_QUIZ[index];
  const progress = ((index) / VIBE_QUIZ.length) * 100;

  function choose(choiceIndex: number) {
    const next = [...answers, { questionId: question.id, choiceIndex }];
    setAnswers(next);
    if (index + 1 < VIBE_QUIZ.length) {
      setIndex(index + 1);
    } else {
      onComplete(next);
    }
  }

  return (
    <div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-vibe-gradient"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          <p className="mb-5 text-xs font-medium uppercase tracking-wide text-white/40">
            Question {index + 1} of {VIBE_QUIZ.length}
          </p>
          <h3 className="mb-6 font-display text-xl font-semibold leading-snug">
            {question.prompt}
          </h3>
          <div className="space-y-3">
            {question.choices.map((choice, i) => (
              <motion.button
                key={i}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => choose(i)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm hover:border-vibe-coral/60 hover:bg-white/10"
              >
                {choice.text}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
