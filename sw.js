/*
 * Tonic's service worker: after the first visit the whole app works offline (screens, fonts, the piano samples).
 * vite.config.ts fills in VERSION and FILES (everything in the build) and writes this to dist/sw.js.
 *
 * - Everything is served from the cache first; a new build installs alongside and waits.
 * - The page shows "New version ready · Reload"; Reload tells the waiting worker to take over.
 */
const VERSION = '0266a0be1e'
const FILES = ["apple-touch-icon.png","assets/Bravura-CEAu5fi8.woff2","assets/Card-BVvIzilC.js","assets/ChordExplorer-h15u5nd0.js","assets/ChordTrainer-Cgko42hq.js","assets/ChordTrainer-G881O5GW.js","assets/CircleOfFifths-CCtHOg0I.js","assets/CircleOfFifthsWheel-DG067pCw.js","assets/DailyWorkout-b2MK1ei1.js","assets/EarTraining-BZkgflAT.js","assets/EarTraining-CsS-8fNz.js","assets/ExploreHub-zS5WmNy8.js","assets/FreePlay-CbEJpGK3.js","assets/Gallery-Bhg-rPw6.js","assets/GameParts-FpShTIAL.js","assets/GoalProgress-DPGyMe3S.js","assets/GuitarDiagram-Dni_M0cs.js","assets/KeyQuiz-BdJbbYcw.js","assets/LessonPlayer-DompncHw.js","assets/Metronome-DjFkAlY2.js","assets/MetronomeMini-BDWgnJnU.js","assets/MicLab-1iUP_v3x.js","assets/MicPrompt-DEiavZ7B.js","assets/MusicText-BXJK5a3C.js","assets/NoteRush-BMu3WZKQ.js","assets/NoteRush-CN2Ip2Ek.js","assets/OctavePicker-Bdyo1ZYU.js","assets/Page-H8I5AmUg.js","assets/Piano-BC9SgQYc.js","assets/PracticeHub-bS9vovEm.js","assets/ProgressionJam-DLo3gpx2.js","assets/RhythmTap-Bd0n7Y9_.js","assets/RhythmTap-PTHR9vVE.js","assets/ScaleExplorer-CKeuQWQR.js","assets/ScoreStaff-DbmHIBZk.js","assets/Settings-B90LzzXN.js","assets/SongList-BIT-UUaG.js","assets/SongPlayer-DsQTdEjo.js","assets/Staff-B5jcTkbv.js","assets/StaffSvg-C9-u3SD6.js","assets/StepPattern-BRwLCDY9.js","assets/TopBar-DahlazpN.js","assets/WidgetsGallery-D8fld2ru.js","assets/arrow-right-q6tD-SWz.js","assets/audio-lines-DfcpYC-V.js","assets/backup-CXPEZYqw.js","assets/check-C2HnfwR6.js","assets/chevron-left-D48sqFeL.js","assets/chevron-right-B4-sj8t_.js","assets/chordTools-C8BGewUt.js","assets/chords-DH9ufTH5.js","assets/colors-DycGgxIh.js","assets/crosshair-D-SZ70B6.js","assets/disc-3-CYec34FR.js","assets/download-eTOXNPPn.js","assets/drum-BKbY3FcI.js","assets/ear-CpjEB9Eg.js","assets/eraser-DduCNG7X.js","assets/files-Dtgg2Zor.js","assets/finish-CS7CUTAq.js","assets/fit-CPVx-Pn8.js","assets/focus-DenNP-DS.js","assets/footprints-C1tPBlV9.js","assets/fraunces-latin-ext-full-normal-YHFkNujK.woff2","assets/fraunces-latin-full-normal-CFFu7zhK.woff2","assets/gauge-DPtJnKbi.js","assets/guitar--IRLetge.js","assets/hand-DnRrXFxd.js","assets/hash-D82DIrA2.js","assets/heard-DmzrRLI1.js","assets/history-CXS2gv0p.js","assets/importRequest-D_83mkSK.js","assets/index-Yn8n6h1S.css","assets/index-iLYYIfx4.js","assets/info-BgfI6k0E.js","assets/jam-DfbuiI3R.js","assets/keys-ybhKd1SV.js","assets/layers-kUwMvBHc.js","assets/library-TSm4j69E.js","assets/lightbulb-8FiLw-jC.js","assets/links-Bn1RO5h-.js","assets/list-music--AYDXJJX.js","assets/micMatch-CeKy8l0F.js","assets/music-2-BnV6b_PN.js","assets/music-CJcMvnYD.js","assets/musicxml-Bb1XVUht.js","assets/naming-C3NYyoIw.js","assets/nunito-latin-ext-wght-normal-CXYtwYOx.woff2","assets/nunito-latin-wght-normal-BzFMHfZw.woff2","assets/parse-BrdKrE6K.js","assets/pause-UnQIw36R.js","assets/pencil-j5Fbipwu.js","assets/piano-Ce0_bdab.js","assets/play-BrEo3rfa.js","assets/play-DfMnLXxJ.js","assets/plus-BQcgVZxy.js","assets/progress-BA9rc-zM.js","assets/progress-D_7LeqrB.js","assets/repeat-C3x_wKyO.js","assets/rhythm-cwi4gsqX.js","assets/rotate-ccw-D1ssPJlZ.js","assets/score-y-dspa1_.js","assets/skip-forward-Bn1gmFs_.js","assets/sliders-horizontal-ByALQ3uV.js","assets/sparkles-CaNb9F9o.js","assets/stats-BIwZfIH0.js","assets/stepText-R-ffDDw3.js","assets/target-VY-G6-kt.js","assets/theory-BuLtf7Sz.js","assets/timeline-BWNA6pNA.js","assets/timer-DtLXkU2i.js","assets/timing-SsxKu26U.js","assets/trash-Bfw4S2yv.js","assets/trophy-CVYZ9HBb.js","assets/undo-2-Boqc-LP9.js","assets/upload-B7ClcU6k.js","assets/use-transform-97k54otc.js","assets/useHandsFree-D2Fe8ndO.js","assets/useTimedRun-CIqJm0AF.js","assets/useViewport-BYhVdNLD.js","assets/wand-sparkles-Lh0Rkfll.js","assets/waves-horizontal-Cglztiwg.js","assets/weak-BSuxnoGT.js","assets/workout-CmFvHsd6.js","assets/zap-eAW3YJ9Y.js","favicon.svg","icon-192.png","icon-512.png","icon-maskable-512.png","manifest.webmanifest","samples/piano/A0.mp3","samples/piano/A1.mp3","samples/piano/A2.mp3","samples/piano/A3.mp3","samples/piano/A4.mp3","samples/piano/A5.mp3","samples/piano/A6.mp3","samples/piano/A7.mp3","samples/piano/C1.mp3","samples/piano/C2.mp3","samples/piano/C3.mp3","samples/piano/C4.mp3","samples/piano/C5.mp3","samples/piano/C6.mp3","samples/piano/C7.mp3","samples/piano/C8.mp3","samples/piano/Ds1.mp3","samples/piano/Ds2.mp3","samples/piano/Ds3.mp3","samples/piano/Ds4.mp3","samples/piano/Ds5.mp3","samples/piano/Ds6.mp3","samples/piano/Ds7.mp3","samples/piano/Fs1.mp3","samples/piano/Fs2.mp3","samples/piano/Fs3.mp3","samples/piano/Fs4.mp3","samples/piano/Fs5.mp3","samples/piano/Fs6.mp3","samples/piano/Fs7.mp3"]
const CACHE = `tonic-${VERSION}`
const scope = self.registration.scope
const url = (f) => new URL(f, scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', ...FILES.filter((f) => f !== 'index.html')].map(url))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('tonic-') && key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return
  if (req.mode === 'navigate') {
    // The app is one page: open the cached version (it matches the cached files); fall back to the network.
    event.respondWith(caches.match(url('./'), { ignoreVary: true }).then((hit) => hit ?? fetch(req)))
    return
  }
  event.respondWith(
    // ignoreVary: module scripts carry an Origin header the pre-download didn't, and built files never change.
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          // Anything the build list missed is kept for next time.
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            void caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        }),
    ),
  )
})
