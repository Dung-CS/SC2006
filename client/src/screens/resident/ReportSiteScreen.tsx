/**
 * D-Fence — Report a Site screen (REQUIREMENTS.md 11.2.8).
 * Stereotype: <<boundary>>. Traces: 11.2.8, 5.1.1–5.1.6, 5.1.15–5.1.17, 11.3.20, 11.5.1–11.5.3,
 * 11.6.x, 10.5.3.
 *
 * **The pest comes first (11.3.20).** Nothing else on the form is active until one is chosen, and
 * that is not a stylistic preference: the pest decides which later fields are mandatory (5.1.16),
 * whether anyone from D-Fence will be sent at all (8.1.14), and who the resident should be calling
 * instead. Asking for a description first and the pest last would collect the answer that changes
 * the form after the form has been filled in.
 *
 * The character counter is present from the first keystroke rather than appearing at 500 (11.5.2).
 * A counter that materialises at the moment of failure is a reprimand; one that is always there is
 * a guide, and it is the same limit the server enforces at 5.1.4, imported from the same constant
 * rather than retyped — a client limit that drifts from the server's is worse than none, because
 * it rejects submissions the system would have accepted.
 *
 * The photo rules (5.1.5, 5.1.6) are checked here **and** on the server. That is not duplication to
 * be tidied away later: the client check exists so a resident on a phone learns their 12 MB photo
 * is too large before uploading it over mobile data, and the server check exists because the client
 * one is advisory.
 */
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/ApiClient';
import { Field, field, FormField } from '../../components/Field';
import { evaluate, formIsValid, maxLength, required } from '../../components/FieldValidation';
import { LocationContext, PestType, ReportType } from '../../../../src/entity/enums';
import { link } from '../../components/Link';
import { MAX_DESCRIPTION_CHARS } from '../../../../src/control/ReportController';
import { MAX_PHOTOS_PER_REPORT, MAX_PHOTO_BYTES } from '../../../../src/entity/ReportPhoto';
import { uploadPhoto } from '../../lib/PhotoUpload';
import { SAMPLE_REPORT_PHOTOS, SamplePhotoOption } from '../../lib/reportVisuals';
import { analyzePestPhoto, preparePestPhoto, computeTriagePriority, PestRecognitionResult } from '../../lib/pestRecognition';
import { VisionDetectionOverlay } from '../../components/VisionDetectionOverlay';
import { ScreenProps } from '../ScreenProps';

interface PhotoDraft {
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  thumbnailUrl?: string;
}

/** The words a resident uses, mapped to the enum the data dictionary uses (10.5.1). */
const TYPE_LABELS: Record<ReportType, string> = {
  [ReportType.StandingWater]: 'Standing water',
  [ReportType.UnclearedRefuse]: 'Uncleared refuse',
  [ReportType.BlockedDrain]: 'Blocked drain',
  [ReportType.OvergrownVegetation]: 'Overgrown vegetation',
  [ReportType.Other]: 'Something else',
};

const MEGABYTE = 1024 * 1024;

/** One row of /api/pests. The class is what 5.1.16 and 8.1.14 both turn on. */
interface PestRow {
  pestType: string;
  pestClass: string;
  authority: string;
  contactNumber: string;
  referred: boolean;
}

/** 10.5.1 — the data dictionary's identifier, spaced for reading. Not renamed, only spaced. */
function readable(pestType: string): string {
  return pestType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function ReportSiteScreen(props: ScreenProps): JSX.Element {
  // 11.3.20 — no pest chosen yet. Empty rather than defaulted to Mosquito: a defaulted pest type
  // is indistinguishable from a chosen one, and it decides who the case goes to.
  const [pestType, setPestType] = useState<string>('');
  const [locationContext, setLocationContext] = useState<LocationContext | ''>('');
  const [injuryReported, setInjuryReported] = useState(false);
  const [foulingReported, setFoulingReported] = useState(false);
  const [specimenCount, setSpecimenCount] = useState<number>(1);
  const [countConfirmed, setCountConfirmed] = useState(false);
  const [pests, setPests] = useState<PestRow[]>([]);
  const [type, setType] = useState<ReportType>(ReportType.StandingWater);
  const [description, setDescription] = useState<FormField>(field());
  const [latitude, setLatitude] = useState<FormField>(field());
  const [longitude, setLongitude] = useState<FormField>(field());
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [failure, setFailure] = useState<{ cause: string; remedy: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiResult, setAiResult] = useState<PestRecognitionResult | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const [analysisImage, setAnalysisImage] = useState('');
  const analysisSequence = useRef(0);
  useEffect(() => () => { analysisSequence.current += 1; }, []);

  // The catalogue, for the labels and — the part that matters — the pest class. Failure is silent
  // on purpose: a resident who cannot reach /api/pests can still file a report, they simply do not
  // get the "AVS handles this" hint. Blocking the form on a reference lookup would be worse.
  //
  // A 200 carrying a body of the wrong shape is the same situation as a failure and is treated as
  // one: a rejected promise is not the only way a reference lookup disappoints, and an unchecked
  // `v.pests` here renders as a crash on the resident's screen rather than a missing hint.
  useEffect(() => {
    props.api
      .get<{ pests?: PestRow[] }>('/api/pests')
      .then((v) => setPests(Array.isArray(v?.pests) ? v.pests : []))
      .catch(() => setPests([]));
  }, [props.api]);

  const chosen = pests.find((p) => p.pestType === pestType) ?? null;
  const isWildlife = chosen?.pestClass === 'Wildlife';
  /** 11.3.20 — everything after the pest is inert until one is chosen. */
  const pestChosen = pestType !== '';

  const descriptionRules = [required('Description'), maxLength(MAX_DESCRIPTION_CHARS, '5.1.4')];
  // 5.1.2 — a report must carry a location. The Singapore bounds are the server's to enforce;
  // the rule here is only that a number was supplied at all.
  const coordinateRules = [
    required('Location'),
    { requirement: '5.1.2', check: (v: string) => (Number.isFinite(Number(v)) ? null : 'that is not a coordinate') },
  ];

  const valid =
    pestChosen &&
    // 5.1.16 — the server refuses a wildlife report with no location context. Enforced here too so
    // the resident is not refused after typing everything else.
    (!isWildlife || locationContext !== '') &&
    formIsValid([
      evaluate(description.value, descriptionRules),
      evaluate(latitude.value, coordinateRules),
      evaluate(longitude.value, coordinateRules),
    ]);

  const densityNeedsCount = !countConfirmed && !injuryReported && [PestType.Rat, PestType.Cockroach, PestType.Pigeon, PestType.HouseCrow, PestType.Mosquito].includes(pestType as PestType);
  const liveTriage = densityNeedsCount ? { priority: 'Medium' as const, rationale: 'Confirm the observed count to assess density. The report count is currently unknown.' } : computeTriagePriority(
    pestType,
    specimenCount,
    locationContext,
    injuryReported,
    foulingReported,
  );

  function applyAiSuggestions(res: PestRecognitionResult): void {
    if (res.status !== 'detected') return;
    setPestType(res.pestType);
    setSpecimenCount(res.estimatedCount);
    setCountConfirmed(true);
    setAiApplied(true);
  }

  function triggerAiAnalysis(target: File): void {
    const sequence = ++analysisSequence.current;
    setAiAnalyzing(true);
    setAiResult(null);
    setAiApplied(false);
    setAnalysisImage('');
    const reader = new FileReader();
    reader.onload = () => { if (sequence === analysisSequence.current) setAnalysisImage(String(reader.result)); };
    reader.readAsDataURL(target);
    void analyzePestPhoto(target, props.api).then((res) => {
      if (sequence === analysisSequence.current) setAiResult(res);
    }).catch(() => {
      if (sequence === analysisSequence.current) setAiResult({ status: 'unavailable', message: 'Photo analysis failed. Confirm the pest and observed count manually.' });
    }).finally(() => {
      if (sequence === analysisSequence.current) setAiAnalyzing(false);
    });
  }

  function updateCount(newCount: number): void {
    if (Number.isFinite(newCount)) setSpecimenCount(Math.max(1, Math.min(500, Math.round(newCount))));
    setAiApplied(false);
    setCountConfirmed(true);
  }

  function attachSamplePhoto(sample: SamplePhotoOption): void {
    // Only fixed, bundled static assets. No user URL or arbitrary server-side fetch.
    if (!SAMPLE_REPORT_PHOTOS.includes(sample) || !/^\/visuals\/[a-zA-Z0-9_./-]+$/.test(sample.url)) return;
    const sequence = ++analysisSequence.current;
    setAiResult(null);
    setAiAnalyzing(false);
    setUploading(true);
    void fetch(sample.url, { redirect: 'error', signal: AbortSignal.timeout(10000) })
      .then(async (response) => {
        if (!response.ok) throw new Error('Sample unavailable');
        const blob = await response.blob();
        return preparePestPhoto(new File([blob], 'sample', { type: blob.type }));
      }).then((file) => {
        if (sequence === analysisSequence.current) addPhoto(new File([file], `${sample.id}.jpg`, { type: file.type }));
      }).catch(() => {
        if (sequence === analysisSequence.current) setFailure({ cause: 'The sample photograph could not be loaded', remedy: 'Choose a photo file or try again' });
      }).finally(() => { if (sequence === analysisSequence.current) setUploading(false); });
  }

  /**
   * 5.1.5, 5.1.6 — refuse locally what the server would refuse, before it costs an upload; then
   * actually upload what survives.
   */
  function addPhoto(file: File): void {
    if (photos.length >= MAX_PHOTOS_PER_REPORT) {
      setFailure({
        cause: `a report may carry at most ${MAX_PHOTOS_PER_REPORT} photographs`,
        remedy: 'remove one before adding another',
      });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setFailure({
        cause: `${file.name} is ${(file.size / MEGABYTE).toFixed(1)} MB; the limit is ${MAX_PHOTO_BYTES / MEGABYTE} MB`,
        remedy: 'choose a smaller photograph, or reduce its resolution',
      });
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type.toLowerCase())) {
      setFailure({
        cause: `${file.name} is a ${file.type}; only JPEG and PNG photographs are accepted`,
        remedy: 'choose a JPEG or PNG photograph',
      });
      return;
    }
    setFailure(null);
    setUploading(true);
    triggerAiAnalysis(file);
    void uploadPhoto(props.api, 'report', file).then((outcome) => {
      if (outcome.ok) {
        setPhotos((current) => [
          ...current,
          {
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            storageKey: outcome.photo.key,
          },
        ]);
      } else {
        setFailure(outcome.failure);
      }
    }).catch(() => {
      setFailure({ cause: 'the photograph could not be attached', remedy: 'try again or submit the report without a photograph' });
    }).finally(() => setUploading(false));
  }

  /** 11.6.x — the device's own position, which is what a resident standing at the site has. */
  function useMyLocation(): void {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setLatitude({ value: position.coords.latitude.toFixed(6), touched: true });
        setLongitude({ value: position.coords.longitude.toFixed(6), touched: true });
      },
      () =>
        setFailure({
          cause: 'your device would not share its location',
          // The manual fields stay available, so a refused permission is not a dead end.
          remedy: 'allow location access, or type the coordinates below',
        }),
    );
  }

  async function submit(event: { preventDefault: () => void }): Promise<void> {
    event.preventDefault();
    setDescription((f) => ({ ...f, touched: true }));
    setLatitude((f) => ({ ...f, touched: true }));
    setLongitude((f) => ({ ...f, touched: true }));
    if (!valid || busy) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const trimmedDesc = description.value.trim();
      const countTagRegex = /^\[Count:\s*\d+\]\s*\[Priority:\s*\w+\]\s*/;
      const cleanDesc = trimmedDesc.replace(countTagRegex, '').trim();
      const finalDesc = countConfirmed ? `[Count: ${specimenCount}] [Priority: ${liveTriage.priority}] ${cleanDesc}` : cleanDesc;
      const result = await props.api.post<{ reportId: string }>('/api/reports', {
        latitude: Number(latitude.value),
        longitude: Number(longitude.value),
        type,
        pestType, // 5.1.15
        ...(locationContext === '' ? {} : { locationContext }), // 5.1.16
        ...(injuryReported ? { injuryReported: true } : {}), // 5.1.17
        ...(countConfirmed ? { estimatedCount: specimenCount } : {}),
        description: finalDesc,
        photos,
      });
      props.onNavigate(`/reports/${result.reportId}`);
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setFailure({
        cause: f?.error ?? 'the report could not be submitted',
        remedy: f?.remedy ?? 'correct the submission and try again',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-screen="ReportSite" data-requirement="11.2.8">
      <h1>Report a pest</h1>
      <form onSubmit={submit} noValidate>
        <div className="form-step-notice" role="note">
          <span className="form-step-badge">Step 1</span>
          <span>Choose what you saw below to begin your report.</span>
        </div>

        {/* 5.1.15, 11.3.20 — first, and everything else waits on it. */}
        <label htmlFor="pestType">What did you see?</label>
        <select
          id="pestType"
          value={pestType}
          onChange={(e) => {
            setPestType(e.target.value);
            setLocationContext('');
            setAiApplied(false);
          }}
          data-part="pest-type"
        >
          <option value="">Choose a pest…</option>
          {(pests.length > 0 ? pests.map((p) => p.pestType) : Object.values(PestType)).map((option) => (
            <option key={option} value={option}>
              {readable(option)}
            </option>
          ))}
        </select>

        {/* 8.1.14 in words, and before the form is filled in rather than after it is submitted.
            11.2.27's screen is one click away, which is the dialog map's whoThisHandles transition. */}
        {chosen?.referred === true ? (
          <p data-part="authority" role="status">
            {chosen.authority} handles {readable(chosen.pestType)}, not D-Fence. We will pass this to
            them. If the animal is inside or someone is hurt, call{' '}
            <a href={`tel:${chosen.contactNumber.replace(/\s/g, '')}`}>{chosen.contactNumber}</a>{' '}
            first.{' '}
            <a href="/pests" onClick={link(props, '/pests')}>
              Who handles which pest
            </a>
          </p>
        ) : null}

        {/* 5.1.16 — mandatory for wildlife, because 4.4.7 raises an indoor sighting to Critical and
            cannot do so from a value nobody supplied. Not shown for other pests: an unanswerable
            question on a cockroach report is a question nobody answers accurately. */}
        {isWildlife ? (
          <fieldset data-part="location-context">
            <legend>Where was the animal?</legend>
            {Object.values(LocationContext).map((option) => (
              <label key={option} htmlFor={`context-${option}`}>
                <input
                  id={`context-${option}`}
                  type="radio"
                  name="locationContext"
                  value={option}
                  checked={locationContext === option}
                  onChange={() => setLocationContext(option)}
                />{' '}
                {option === LocationContext.Indoor ? 'Inside a building' : 'Outdoors'}
              </label>
            ))}
          </fieldset>
        ) : null}

        {/* 5.1.17 — optional on any report, and 4.4.8 turns on it. */}
        <label htmlFor="injury" className="injury-checkbox-label">
          <input
            id="injury"
            type="checkbox"
            checked={injuryReported}
            onChange={(e) => setInjuryReported(e.target.checked)}
          />{' '}
          Someone was hurt
        </label>

        {pestType === PestType.Pigeon || pestType === PestType.HouseCrow ? (
          <label htmlFor="fouling"><input id="fouling" type="checkbox" checked={foulingReported} onChange={(e) => setFoulingReported(e.target.checked)} /> I observed surface fouling or droppings</label>
        ) : null}

        {pestChosen ? (
          <fieldset data-part="specimen-count" className="specimen-count-fieldset">
            <legend>Specimen count & triage priority</legend>
            <label htmlFor="count-confirmed"><input id="count-confirmed" type="checkbox" checked={countConfirmed} onChange={(e) => setCountConfirmed(e.target.checked)} /> I confirm the report count from my observation</label>
            {!countConfirmed && <p>The count is unknown until you confirm it. No count will be stored.</p>}
            <div className="specimen-count-row">
              <label htmlFor="specimen-count-input" className="specimen-count-label">
                Number observed / estimated density:
              </label>
              <div className="specimen-stepper-wrap">
                <button
                  type="button"
                  className="specimen-stepper-btn"
                  onClick={() => updateCount(specimenCount - 1)}
                  aria-label="Decrease count"
                >
                  −
                </button>
                <input
                  id="specimen-count-input"
                  type="number"
                  min="1"
                  max="500"
                  value={specimenCount}
                  onChange={(e) => updateCount(parseInt(e.target.value, 10) || 1)}
                  className="specimen-count-field"
                />
                <button
                  type="button"
                  className="specimen-stepper-btn"
                  onClick={() => updateCount(specimenCount + 1)}
                  aria-label="Increase count"
                >
                  +
                </button>
                <div className="specimen-presets" role="group" aria-label="Quick count presets">
                  {[1, 5, 10, 15, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`specimen-preset-chip ${specimenCount === preset ? 'active' : ''}`}
                      onClick={() => updateCount(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`triage-live-banner tier-${liveTriage.priority.toLowerCase()}`} data-tier={liveTriage.priority}>
              <div className="triage-live-top">
                <span className="triage-live-label">Provisional triage (verify observed inputs):</span>
                <span className={`triage-badge tone-${liveTriage.priority.toLowerCase()}`}>
                  {liveTriage.priority} Priority
                </span>
              </div>
              <p className="triage-live-rationale">{liveTriage.rationale}</p>
            </div>
          </fieldset>
        ) : null}

        <div className="form-field-wrapper">
          <label htmlFor="type">What did you find?</label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as ReportType)}
            disabled={!pestChosen}
          >
            {Object.values(ReportType).map((option) => (
              <option key={option} value={option}>
                {TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <Field
          id="description"
          label="Describe what you saw"
          multiline
          value={description.value}
          touched={description.touched}
          rules={descriptionRules}
          max={MAX_DESCRIPTION_CHARS}
          onChange={(v) => setDescription({ value: v, touched: description.touched })}
        />

        <fieldset data-part="location">
          <legend>Where is it?</legend>
          <button type="button" onClick={useMyLocation}>
            Use my current location
          </button>
          <Field
            id="latitude"
            label="Latitude"
            value={latitude.value}
            touched={latitude.touched}
            rules={coordinateRules}
            onChange={(v) => setLatitude({ value: v, touched: latitude.touched })}
          />
          <Field
            id="longitude"
            label="Longitude"
            value={longitude.value}
            touched={longitude.touched}
            rules={coordinateRules}
            onChange={(v) => setLongitude({ value: v, touched: longitude.touched })}
          />
        </fieldset>

        <fieldset data-part="photos">
          <legend>Photographs (required: attach at least 1 photo, up to {MAX_PHOTOS_PER_REPORT})</legend>

          <div className="sample-photos-picker">
            <p id="sample-photos-label" className="sample-photos-title">
              Quick-attach authentic evidence photo:
            </p>
            <div className="sample-chips" role="group" aria-labelledby="sample-photos-label">
              {SAMPLE_REPORT_PHOTOS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className="sample-photo-chip"
                  disabled={uploading}
                  onClick={() => attachSamplePhoto(sample)}
                  title={`Attach sample: ${sample.description}`}
                >
                  <img src={sample.url} alt="" aria-hidden="true" className="sample-chip-img" />
                  <span>{sample.name}</span>
                </button>
              ))}
            </div>
          </div>

          <label htmlFor="photo">Add a photograph</label>
          <input
            id="photo"
            type="file"
            accept="image/jpeg,image/png"
            // 11.8.13 — on a phone this opens the rear camera directly instead of the photo
            // library. A resident is standing at the drain and a crew member is standing in it;
            // the photograph they need does not exist yet, so offering a gallery first is one tap
            // in the wrong direction. Desktop browsers ignore the attribute.
            capture="environment"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) {
                addPhoto(file);
              }
              // Cleared so the same photograph can be chosen again after a failure.
              event.target.value = '';
            }}
          />
          {uploading ? (
            <p role="status" data-part="uploading">
              Uploading the photograph…
            </p>
          ) : null}

          <ul className="attached-photos-list">
            {photos.map((photo, index) => (
              <li key={photo.storageKey + index} className="attached-photo-item">
                {photo.thumbnailUrl ? (
                  <img src={photo.thumbnailUrl} alt={photo.filename} className="attached-photo-thumb" />
                ) : null}
                <div className="attached-photo-meta">
                  <span className="attached-photo-name">{photo.filename}</span>
                  <span className="attached-photo-size">{(photo.sizeBytes / 1024).toFixed(0)} KB</span>
                </div>
                <button type="button" onClick={() => { setPhotos(photos.filter((_, i) => i !== index)); analysisSequence.current += 1; setAiResult(null); setAiAnalyzing(false); }}>
                  Remove {photo.filename}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        {aiAnalyzing ? (
          <div className="ai-vision-card ai-vision-scanning" role="status" aria-live="polite">
            <div className="ai-scanner-spinner" />
            <div className="ai-scanner-text">
              <strong>D-Fence analysing photograph…</strong>
              <span>Checking visible pest species and specimens. You will need to confirm the result.</span>
            </div>
          </div>
        ) : null}

        {aiResult !== null && !aiAnalyzing ? (
          <div className="ai-vision-card" data-part="ai-vision-assessment" role="status">
            {aiResult.cacheHit ? <p data-part="vision-cache-note">Previous analysis of this exact photo.</p> : null}
            {aiResult.status === 'detected' ? <>
              <h3>Photo analysis: {aiResult.estimatedCount} {readable(aiResult.pestType)} detected</h3>
              <p>Check the image and confirm the species and count. AI can miss or misidentify animals.</p>
              {analysisImage && <VisionDetectionOverlay imageUrl={analysisImage} boundingBoxes={aiResult.boundingBoxes} alt="Analysed photograph" />}
              <button type="button" onClick={() => applyAiSuggestions(aiResult)}>
                {aiApplied ? 'Species and count confirmed' : 'Use detected species and count'}
              </button>
              <p>Report count: {countConfirmed ? specimenCount : 'unknown'} (editable above). Detection boxes remain the original model result.</p>
            </> : <p>{aiResult.message}</p>}
          </div>
        ) : null}

        {failure === null ? null : (
          <div role="alert" data-part="error">
            <p>{failure.cause}</p>
            <p>{failure.remedy}</p>
          </div>
        )}
        <button type="submit" disabled={busy || uploading}>
          {busy ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </section>
  );
}
