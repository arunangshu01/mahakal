import { useEffect, useRef, useState } from 'react'
import './MusicPlayer.css'

const DEFAULT_SONG_URL = 'https://music.youtube.com/watch?v=STq6tE6un6E'
let youtubeApiPromise

function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeApiPromise) return youtubeApiPromise
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const script = document.createElement('script')
    const finish = (error) => {
      clearTimeout(timeout)
      window.onYouTubeIframeAPIReady = previous
      if (error) {
        youtubeApiPromise = null
        script.remove()
        reject(error)
      } else {
        resolve(window.YT)
      }
    }
    const timeout = setTimeout(() => finish(new Error('YouTube did not load.')), 15000)
    window.onYouTubeIframeAPIReady = () => {
      finish()
      previous?.()
    }
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => finish(new Error('YouTube could not be loaded.'))
    document.head.append(script)
  })
  return youtubeApiPromise
}

function musicEmbedUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (url.hostname === 'open.spotify.com' && /^\/track\/[A-Za-z0-9]+$/.test(url.pathname)) {
      return `https://open.spotify.com/embed${url.pathname}`
    }
    const id = url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : ['www.youtube.com', 'youtube.com', 'music.youtube.com'].includes(url.hostname) && url.pathname === '/watch'
        ? url.searchParams.get('v')
        : null
    return /^[\w-]{11}$/.test(id ?? '') ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=0` : null
  } catch {
    return null
  }
}

function MusicIcon({ name }) {
  const paths = {
    play: 'm8 5 11 7-11 7Z',
    pause: 'M8 5v14M16 5v14',
    minimize: 'M5 18h14',
    restore: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
    close: 'm6 6 12 12M6 18 18 6',
    volume: 'M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
    muted: 'M11 5 6 9H3v6h3l5 4ZM16 9l6 6M16 15l6-6',
    external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}

export default function MusicPlayer({ status, notificationId, songUrl = import.meta.env.VITE_MUSIC_URL || DEFAULT_SONG_URL }) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const minimizedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [track, setTrack] = useState(null)
  const [volume, setVolume] = useState(55)
  const [dismissedNotification, setDismissedNotification] = useState(null)
  const notificationActive = notificationId != null && notificationId !== dismissedNotification
  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const baselineRef = useRef(55)
  const wasDuckedRef = useRef(false)
  const restoredRef = useRef(true)
  const src = musicEmbedUrl(songUrl)
  const youtube = Boolean(src?.includes('youtube-nocookie.com'))
  const currentTrack = open && track?.source === src ? track : null
  const currentSongUrl = currentTrack?.videoId ? `https://www.youtube.com/watch?v=${currentTrack.videoId}` : songUrl
  const ducked = status !== 'idle' || notificationActive
  const duckedRef = useRef(ducked)

  useEffect(() => {
    duckedRef.current = ducked
  }, [ducked])

  useEffect(() => {
    if (notificationId == null) return
    const timeout = setTimeout(() => setDismissedNotification(notificationId), 3000)
    return () => clearTimeout(timeout)
  }, [notificationId])

  useEffect(() => {
    if (!open || !youtube) return
    let cancelled = false
    let player
    let metadataTimer
    const syncTrack = (target) => {
      if (cancelled) return
      const data = target.getVideoData?.()
      const title = typeof data?.title === 'string' ? data.title.trim() : ''
      const videoId = /^[\w-]{11}$/.test(data?.video_id ?? '') ? data.video_id : null
      setTrack((previous) => previous?.source === src && previous.title === title && previous.videoId === videoId
        ? previous : { source: src, title, videoId })
    }
    const container = containerRef.current
    loadYouTube().then((YT) => {
      if (cancelled) return
      setReady(false)
      setError('')
      setTrack(null)
      const frame = document.createElement('iframe')
      frame.title = 'YouTube music player'
      frame.src = `${src}&enablejsapi=1&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`
      frame.allow = 'encrypted-media; fullscreen; picture-in-picture'
      frame.referrerPolicy = 'strict-origin-when-cross-origin'
      frame.allowFullscreen = true
      container.append(frame)
      player = new YT.Player(frame, {
        events: {
          onReady: ({ target }) => {
            if (cancelled) return
            playerRef.current = target
            if (minimizedRef.current) target.pauseVideo()
            setPlaying(!minimizedRef.current && target.getPlayerState?.() === 1)
            setMuted(target.isMuted?.() ?? false)
            syncTrack(target)
            metadataTimer = setInterval(() => syncTrack(target), 1000)
            target.setVolume(duckedRef.current ? Math.min(baselineRef.current, 8) : baselineRef.current)
            wasDuckedRef.current = duckedRef.current
            restoredRef.current = !duckedRef.current
            setReady(true)
          },
          onStateChange: ({ target, data }) => {
            if (cancelled) return
            syncTrack(target)
            if (minimizedRef.current && (data === 1 || data === 3)) {
              target.pauseVideo()
              setPlaying(false)
              return
            }
            setPlaying(data === 1 || data === 3)
            setMuted(target.isMuted?.() ?? false)
            if (data === 1 || data === 5) setError('')
          },
          onError: () => {
            if (!cancelled) setError('This recording cannot play here. Try the streaming service link below.')
          },
        },
      })
    }).catch(() => {
      if (!cancelled) setError('The music player could not load. Try reopening it or use the link below.')
    })
    return () => {
      cancelled = true
      clearInterval(metadataTimer)
      playerRef.current = null
      player?.destroy()
      container.replaceChildren()
    }
  }, [open, youtube, src])

  useEffect(() => {
    const player = playerRef.current
    if (!open || !ready || !player) return
    if (ducked && !wasDuckedRef.current && restoredRef.current) baselineRef.current = player.getVolume()
    wasDuckedRef.current = ducked
    restoredRef.current = false
    const target = ducked ? Math.min(baselineRef.current, 8) : baselineRef.current
    const start = player.getVolume()
    let step = 0
    const timer = setInterval(() => {
      step += 1
      player.setVolume(Math.round(start + (target - start) * step / 8))
      if (step === 8) {
        restoredRef.current = !ducked
        clearInterval(timer)
      }
    }, 40)
    return () => clearInterval(timer)
  }, [ducked, open, ready, volume])

  const expand = () => {
    minimizedRef.current = false
    setMinimized(false)
    setOpen(true)
  }
  const minimize = () => {
    minimizedRef.current = true
    playerRef.current?.pauseVideo()
    setPlaying(false)
    setMinimized(true)
  }
  const close = () => {
    minimizedRef.current = false
    setMinimized(false)
    setPlaying(false)
    setReady(false)
    setTrack(null)
    setOpen(false)
  }
  const togglePlayback = () => {
    const player = playerRef.current
    if (!player) return
    if (playing) player.pauseVideo()
    else player.playVideo()
  }
  const toggleMute = () => {
    const player = playerRef.current
    if (!player) return
    if (muted) player.unMute()
    else player.mute()
    setMuted(!muted)
  }

  return (
    <section className="music-player" aria-label="Music" data-expanded={open && !minimized}>
      <div className="music-heading">
        <span className="music-title" aria-live="polite" title={currentTrack?.title || 'Music'}>{currentTrack?.title || 'Music'}</span>
        <div className="music-actions">
          {!open || minimized ? (
            <button type="button" aria-label={open ? 'Restore music' : 'Listen to music'} title={open ? 'Restore music (paused)' : 'Listen to music'} aria-expanded={false} aria-controls="music-content" onClick={expand}>
              <MusicIcon name={open ? 'restore' : 'play'} />
            </button>
          ) : youtube && (
            <>
              <button type="button" aria-label={playing ? 'Pause music' : 'Play music'} title={playing ? 'Pause music' : 'Play music'} disabled={!ready || Boolean(error)} onClick={togglePlayback}>
                <MusicIcon name={playing ? 'pause' : 'play'} />
              </button>
              <button type="button" aria-label="Minimize music" title="Minimize music (pauses playback)" aria-expanded={true} aria-controls="music-content" onClick={minimize}>
                <MusicIcon name="minimize" />
              </button>
            </>
          )}
          {open && (
            <button type="button" aria-label="Close music" title="Close music" onClick={close}>
              <MusicIcon name="close" />
            </button>
          )}
        </div>
      </div>
      {open && (
        <div id="music-content" hidden={minimized}>
          {!src ? (
            <p>The official song link is not configured yet.</p>
          ) : (
            <>
              {youtube && ducked && playing && <p className="music-ducked">Volume lowered for the assistant</p>}
              {youtube ? (
                <>
                  <div className="music-video" ref={containerRef} />
                  {error ? <p role="alert">{error}</p> : !ready && <p>Loading music player…</p>}
                  <div className="music-volume">
                    <button type="button" aria-label={muted ? 'Unmute music' : 'Mute music'} title={muted ? 'Unmute music' : 'Mute music'} aria-pressed={muted} disabled={!ready} onClick={toggleMute}>
                      <MusicIcon name={muted || volume === 0 ? 'muted' : 'volume'} />
                    </button>
                    <input aria-label="Music volume" title={`Music volume: ${volume}%`} type="range" min="0" max="100" value={volume} disabled={!ready} onChange={(event) => {
                      const next = Number(event.target.value)
                      baselineRef.current = next
                      setVolume(next)
                    }} />
                  </div>
                </>
              ) : (
                <>
                  <iframe title="Streaming music player" src={src} allow="encrypted-media; fullscreen; picture-in-picture" />
                  <p>Automatic volume ducking is available with the YouTube player only.</p>
                </>
              )}
              <a className="music-external" href={currentSongUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on streaming service" title="Open on streaming service">
                <MusicIcon name="external" />
              </a>
            </>
          )}
        </div>
      )}
    </section>
  )
}
