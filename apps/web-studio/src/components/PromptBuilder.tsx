/**
 * AuraCraft Studio — Prompt Builder Component
 *
 * Form-based identity prompt generator.
 * Fills in character descriptors → auto-generates a structured
 * "Identity Prompt" string for AI image/video tools (Stable Diffusion,
 * Runway, Pika, Kling, etc.).
 *
 * Includes a "Copy to Clipboard" button for quick use.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Wand2, RotateCcw } from 'lucide-react';
import { updateIdentityPrompt } from '../services/characterService';
import type { Character } from '../types/character';

// ─────────────────────────────────────────────
// Form Field Definitions
// ─────────────────────────────────────────────
interface PromptField {
  key: keyof PromptFormState;
  label: string;
  placeholder: string;
  hint?: string;
}

interface PromptFormState {
  gender: string;
  age: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  skinTone: string;
  outfit: string;
  bodyBuild: string;
  accessories: string;
  style: string;
  mood: string;
  extraDetails: string;
}

const FORM_FIELDS: PromptField[] = [
  { key: 'gender',      label: 'Gender',       placeholder: 'e.g. anime girl, woman, male character' },
  { key: 'age',         label: 'Age / Era',    placeholder: 'e.g. teenage, adult, ancient warrior' },
  { key: 'hairColor',   label: 'Hair Color',   placeholder: 'e.g. blue, silver, dark brown' },
  { key: 'hairStyle',   label: 'Hair Style',   placeholder: 'e.g. long flowing, twin tails, short bob' },
  { key: 'eyeColor',    label: 'Eye Color',    placeholder: 'e.g. gold, violet, crimson' },
  { key: 'skinTone',    label: 'Skin Tone',    placeholder: 'e.g. fair, tan, dark, pale' },
  { key: 'outfit',      label: 'Outfit',       placeholder: 'e.g. red kimono with gold trim, military uniform' },
  { key: 'bodyBuild',   label: 'Body Build',   placeholder: 'e.g. slim, athletic, petite' },
  { key: 'accessories', label: 'Accessories',  placeholder: 'e.g. katana, flower hairpin, tech headset' },
  { key: 'style',       label: 'Art Style',    placeholder: 'e.g. anime, hyperrealistic, 3D render, oil painting' },
  { key: 'mood',        label: 'Mood / Pose',  placeholder: 'e.g. confident standing, gentle smile, battle stance' },
  { key: 'extraDetails',label: 'Extra Details',placeholder: 'e.g. glowing runes, fantasy background, studio lighting', hint: 'Add any additional keywords for consistency' },
];

const EMPTY_FORM: PromptFormState = {
  gender: '', age: '', hairColor: '', hairStyle: '', eyeColor: '',
  skinTone: '', outfit: '', bodyBuild: '', accessories: '', style: '', mood: '', extraDetails: '',
};

// ─────────────────────────────────────────────
// Prompt Generator
// ─────────────────────────────────────────────
function buildPromptString(form: PromptFormState): string {
  const parts: string[] = [];

  if (form.gender) parts.push(form.gender);
  if (form.age) parts.push(form.age);
  if (form.hairColor && form.hairStyle) parts.push(`${form.hairColor} ${form.hairStyle} hair`);
  else if (form.hairColor) parts.push(`${form.hairColor} hair`);
  else if (form.hairStyle) parts.push(`${form.hairStyle} hair`);
  if (form.eyeColor) parts.push(`${form.eyeColor} eyes`);
  if (form.skinTone) parts.push(`${form.skinTone} skin`);
  if (form.bodyBuild) parts.push(`${form.bodyBuild} build`);
  if (form.outfit) parts.push(`wearing ${form.outfit}`);
  if (form.accessories) parts.push(form.accessories);
  if (form.mood) parts.push(form.mood);
  if (form.style) parts.push(form.style);
  if (form.extraDetails) parts.push(form.extraDetails);

  return parts.filter(Boolean).join(', ');
}

/** Parse a prompt string back into form fields (best-effort, for existing prompts) */
function parsePromptToForm(prompt: string): Partial<PromptFormState> {
  // Heuristic: if prompt starts with "anime girl", "woman", etc., treat first token as gender
  const tokens = prompt.split(',').map((s) => s.trim()).filter(Boolean);
  if (!tokens.length) return {};
  return { gender: tokens[0], extraDetails: tokens.slice(1).join(', ') };
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface PromptBuilderProps {
  character: Character;
  onPromptSaved?: (prompt: string) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export const PromptBuilder: React.FC<PromptBuilderProps> = ({ character, onPromptSaved }) => {
  const [form, setForm] = useState<PromptFormState>(() => {
    // Pre-fill from existing identity prompt if available
    if (character.identityPrompt) {
      return { ...EMPTY_FORM, ...parsePromptToForm(character.identityPrompt) };
    }
    return EMPTY_FORM;
  });

  const [generatedPrompt, setGeneratedPrompt] = useState(character.identityPrompt || '');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Auto-generate prompt whenever form changes
  useEffect(() => {
    const prompt = buildPromptString(form);
    setGeneratedPrompt(prompt);
  }, [form]);

  const handleFieldChange = (key: keyof PromptFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCopy = useCallback(async () => {
    if (!generatedPrompt) return;
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedPrompt]);

  const handleSave = useCallback(async () => {
    await updateIdentityPrompt(character.id, generatedPrompt);
    setSaved(true);
    onPromptSaved?.(generatedPrompt);
    setTimeout(() => setSaved(false), 2500);
  }, [character.id, generatedPrompt, onPromptSaved]);

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setGeneratedPrompt('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-200">Identity Prompt Builder</h3>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Form Fields: 2-column responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {FORM_FIELDS.map((field) => (
          <div
            key={field.key}
            className={`flex flex-col gap-1 ${field.key === 'extraDetails' ? 'sm:col-span-2' : ''}`}
          >
            <label className="text-xs font-medium text-slate-400">{field.label}</label>
            <input
              type="text"
              value={form[field.key]}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="
                w-full px-3 py-1.5
                bg-[#111827] border border-[#1f293d]
                text-slate-200 placeholder-slate-600
                rounded-lg text-xs
                focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30
                transition-all
              "
            />
            {field.hint && <p className="text-[10px] text-slate-600">{field.hint}</p>}
          </div>
        ))}
      </div>

      {/* Generated Prompt Output */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400">Generated Prompt</label>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isEditing ? 'Lock' : 'Edit manually'}
          </button>
        </div>

        {isEditing ? (
          <textarea
            value={generatedPrompt}
            onChange={(e) => setGeneratedPrompt(e.target.value)}
            rows={4}
            className="
              w-full px-3 py-2
              bg-[#070a12] border border-indigo-500/40
              text-indigo-200 text-xs rounded-lg font-mono
              focus:outline-none focus:border-indigo-400
              resize-none
            "
          />
        ) : (
          <div className="
            px-3 py-2.5 rounded-lg bg-[#070a12]
            border border-[#1f293d] min-h-[64px]
            text-xs text-indigo-200 font-mono leading-relaxed
          ">
            {generatedPrompt || (
              <span className="text-slate-600">Fill in the fields above to generate your identity prompt...</span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!generatedPrompt}
            className={`
              flex-1 flex items-center justify-center gap-1.5
              py-2 rounded-lg text-xs font-semibold transition-all
              ${copied
                ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                : 'bg-[#111827] border border-[#1f293d] text-slate-300 hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed'
              }
            `}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>

          <button
            onClick={handleSave}
            disabled={!generatedPrompt || saved}
            className={`
              flex-1 flex items-center justify-center gap-1.5
              py-2 rounded-lg text-xs font-semibold transition-all
              ${saved
                ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }
            `}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Saved!' : 'Save to Character'}
          </button>
        </div>
      </div>
    </div>
  );
};
