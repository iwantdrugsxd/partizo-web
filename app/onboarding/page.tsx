"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { MIN_TAGS } from "@/data/tags";
import { PROMPT_BANK, PROMPT_COUNT, promptText } from "@/data/prompts";
import { ProfilePrompt, QuizAnswer, UserProfile } from "@/lib/types";
import { computeTraitsFromAnswers, personalityLabel } from "@/lib/vibe";
import AnimatedBackground from "@/components/AnimatedBackground";
import TagPicker from "@/components/TagPicker";
import VibeQuiz from "@/components/VibeQuiz";
import { IconCheck, IconX } from "@/components/icons";

type Step = "basics" | "photos" | "tags" | "prompts" | "quiz" | "done";

const STEP_ORDER: Step[] = ["basics", "photos", "tags", "prompts", "quiz", "done"];

export default function OnboardingPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("basics");
  const [name, setName] = useState(user?.name ?? "");
  const [age, setAge] = useState(22);
  const [gender, setGender] = useState<UserProfile["gender"]>("other");
  const [showMe, setShowMe] = useState<UserProfile["showMePreference"]>("everyone");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<ProfilePrompt[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [openPromptSlot, setOpenPromptSlot] = useState<number | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  function goNext() {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }
  function goBack() {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";
    setUploadingPhoto(true);
    setPhotoError("");
    try {
      const url = await dataProvider.uploadPhoto(user.uid, file);
      setPhotos((p) => [...p, url].slice(0, 4));
    } catch {
      setPhotoError("Couldn't upload that photo. Please try again, or grab a demo avatar below.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const DEMO_AVATARS = [4, 5, 9, 20, 25, 33, 36, 22];

  async function finish(answers: QuizAnswer[]) {
    if (!user) return;
    setSaving(true);
    try {
      await dataProvider.completeOnboarding(user.uid, {
        name,
        age,
        gender,
        showMePreference: showMe,
        city,
        bio,
        photos: photos.length ? photos : ["https://i.pravatar.cc/600?img=68"],
        tags,
        prompts,
        quizAnswers: answers,
      });
      await refresh();
      router.replace("/connect");
    } finally {
      setSaving(false);
    }
  }

  const previewTraits = quizAnswers ? computeTraitsFromAnswers(quizAnswers) : null;

  return (
    <div className="relative min-h-[100dvh] px-6 py-10">
      <AnimatedBackground />

      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={stepIndex === 0}
          className="text-sm text-white/50 disabled:opacity-0"
        >
          ← Back
        </button>
        <p className="text-xs font-medium uppercase tracking-widest text-white/40">
          Step {Math.min(stepIndex + 1, 5)} of 5
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "basics" && (
          <motion.div
            key="basics"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h2 className="mb-1 font-display text-2xl font-bold">Tell us about you</h2>
            <p className="mb-6 text-sm text-white/50">This is how you&apos;ll show up on your card.</p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                />
              </div>
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-white/50">Age</label>
                  <input
                    type="number"
                    min={18}
                    max={70}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-white/50">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">I am</label>
                <div className="flex gap-2">
                  {(["male", "female", "non-binary", "other"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`rounded-full border px-3 py-2 text-xs capitalize ${
                        gender === g
                          ? "border-transparent bg-vibe-gradient"
                          : "border-white/15 bg-white/5 text-white/60"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Show me</label>
                <div className="flex gap-2">
                  {(["everyone", "male", "female", "non-binary"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setShowMe(g)}
                      className={`rounded-full border px-3 py-2 text-xs capitalize ${
                        showMe === g
                          ? "border-transparent bg-vibe-gradient"
                          : "border-white/15 bg-white/5 text-white/60"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Two truths and a vibe..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                />
              </div>
            </div>

            <button
              onClick={goNext}
              disabled={!name || !city}
              className="mt-8 w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-40"
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === "photos" && (
          <motion.div
            key="photos"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h2 className="mb-1 font-display text-2xl font-bold">Add your photos</h2>
            <p className="mb-6 text-sm text-white/50">Upload a real photo, or grab a demo avatar to try things out fast.</p>

            <div className="mb-4 grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
                  <Image src={p} alt="" fill className="object-cover" unoptimized />
                </div>
              ))}
              {photos.length < 4 && (
                <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 text-2xl text-white/40">
                  {uploadingPhoto ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
                  ) : (
                    "+"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={handleFile}
                  />
                </label>
              )}
            </div>
            {photoError && <p className="mb-4 text-xs text-red-400">{photoError}</p>}

            <p className="mb-2 text-xs text-white/40">Or tap a demo avatar:</p>
            <div className="mb-8 flex flex-wrap gap-2">
              {DEMO_AVATARS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setPhotos((p) => (p.length < 4 ? [...p, `https://i.pravatar.cc/600?img=${n}`] : p))
                  }
                  className="relative h-14 w-14 overflow-hidden rounded-full border border-white/15"
                >
                  <Image src={`https://i.pravatar.cc/150?img=${n}`} alt="" fill className="object-cover" unoptimized />
                </button>
              ))}
            </div>

            <button
              onClick={goNext}
              className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow"
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === "tags" && (
          <motion.div
            key="tags"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h2 className="mb-1 font-display text-2xl font-bold">What&apos;s your vibe?</h2>
            <p className="mb-6 text-sm text-white/50">
              Pick {MIN_TAGS}-8 tags. We use these to match you with the right crowd.
            </p>
            <TagPicker selected={tags} onChange={setTags} />
            <button
              onClick={goNext}
              disabled={tags.length < MIN_TAGS}
              className="mt-8 w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-40"
            >
              Continue ({tags.length}/{MIN_TAGS} min)
            </button>
          </motion.div>
        )}

        {step === "prompts" && (
          <motion.div
            key="prompts"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-white/50">
                Pick {PROMPT_COUNT} prompts. These show up on your card alongside your vibe score.
              </p>
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
                {prompts.filter((p) => p?.promptId && p.answer.trim()).length}/{PROMPT_COUNT}
              </span>
            </div>
            <div className="space-y-4">
              {Array.from({ length: PROMPT_COUNT }).map((_, i) => {
                const current = prompts[i];
                const takenIds = prompts.filter((_, j) => j !== i).map((p) => p.promptId);
                const available = PROMPT_BANK.filter((p) => !takenIds.includes(p.id));
                const answerLen = current?.answer?.length ?? 0;
                return (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    {!current?.promptId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenPromptSlot((s) => (s === i ? null : i))}
                          className="flex w-full items-center justify-between text-left text-sm font-medium text-white/50"
                        >
                          <span>Choose a prompt...</span>
                          <span className="text-vibe-coral">{openPromptSlot === i ? "Close" : "Browse"}</span>
                        </button>
                        {openPromptSlot === i && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {available.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setPrompts((prev) => {
                                    const next = [...prev];
                                    next[i] = { promptId: p.id, answer: next[i]?.answer ?? "" };
                                    return next;
                                  });
                                  setOpenPromptSlot(null);
                                }}
                                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70"
                              >
                                {p.text}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{promptText(current.promptId)}</p>
                          <button
                            type="button"
                            aria-label="Change prompt"
                            onClick={() =>
                              setPrompts((prev) => {
                                const next = [...prev];
                                next[i] = { promptId: "", answer: "" };
                                return next;
                              })
                            }
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50"
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        </div>
                        <textarea
                          value={current.answer}
                          autoFocus
                          maxLength={150}
                          onChange={(e) => {
                            setPrompts((prev) => {
                              const next = [...prev];
                              next[i] = { promptId: next[i]?.promptId ?? "", answer: e.target.value };
                              return next;
                            });
                          }}
                          rows={2}
                          placeholder="Your answer..."
                          className="w-full rounded-lg border border-white/10 bg-vibe-card px-3 py-2 text-sm outline-none focus:border-vibe-coral"
                        />
                        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-white/30">
                          {answerLen > 0 && <IconCheck className="h-3 w-3 text-vibe-coral" />}
                          <span>{answerLen}/150</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={goNext}
              disabled={
                prompts.filter((p) => p?.promptId && p.answer.trim()).length < PROMPT_COUNT
              }
              className="mt-8 w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-40"
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === "quiz" && (
          <motion.div key="quiz" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <h2 className="mb-1 font-display text-2xl font-bold">Quick vibe check</h2>
            <p className="mb-6 text-sm text-white/50">Answer honestly - this powers your compatibility score.</p>
            <VibeQuiz
              onComplete={(answers) => {
                setQuizAnswers(answers);
                setStep("done");
              }}
            />
          </motion.div>
        )}

        {step === "done" && quizAnswers && previewTraits && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-vibe-gradient text-3xl shadow-glow"
            >
              ✨
            </motion.div>
            <h2 className="mb-2 font-display text-2xl font-bold">You&apos;re a</h2>
            <p className="mb-6 font-display text-3xl font-extrabold text-gradient">
              {personalityLabel(previewTraits)}
            </p>
            <p className="mb-8 text-sm text-white/50">
              Your profile is ready. Time to find your crowd.
            </p>
            <button
              onClick={() => finish(quizAnswers)}
              disabled={saving}
              className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-60"
            >
              {saving ? "Setting things up..." : "Enter Partizo"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
