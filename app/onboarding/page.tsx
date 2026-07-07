"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { MIN_TAGS } from "@/data/tags";
import { QuizAnswer, UserProfile } from "@/lib/types";
import { computeTraitsFromAnswers, personalityLabel } from "@/lib/vibe";
import AnimatedBackground from "@/components/AnimatedBackground";
import TagPicker from "@/components/TagPicker";
import VibeQuiz from "@/components/VibeQuiz";

type Step = "basics" | "photos" | "tags" | "quiz" | "done";

const STEP_ORDER: Step[] = ["basics", "photos", "tags", "quiz", "done"];

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
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[] | null>(null);
  const [saving, setSaving] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);

  function goNext() {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }
  function goBack() {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((p) => [...p, reader.result as string].slice(0, 4));
    };
    reader.readAsDataURL(file);
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
    <div className="relative min-h-screen px-6 py-10">
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
          Step {Math.min(stepIndex + 1, 4)} of 4
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
            <p className="mb-6 text-sm text-white/50">This is how you'll show up on your card.</p>

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
                <div className="flex-1">
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
                <div className="flex-1">
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
                  +
                  <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                </label>
              )}
            </div>

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
            <h2 className="mb-1 font-display text-2xl font-bold">What's your vibe?</h2>
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
            <h2 className="mb-2 font-display text-2xl font-bold">You're a</h2>
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
