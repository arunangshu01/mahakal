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

export default function MusicPlayer({ status, notificationId, songUrl = import.meta.env.VITE_MUSIC_URL || DEFAULT_SONG_URL }) {
  const [open, setOpen] = useState(false)
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

  return (
    <section className="music-player" aria-label="Music">
      <div className="music-heading">
        <span className="music-title" aria-live="polite">{currentTrack?.title || 'Music'}</span>
        <button type="button" aria-expanded={open} aria-controls="music-content" onClick={() => setOpen(!open)}>
          {open ? 'Close music' : 'Listen to music'}
        </button>
      </div>
      {open && (
        <div id="music-content">
          {!src ? (
            <p>The official song link is not configured yet.</p>
          ) : (
            <>
              <p>{youtube && ducked ? 'Music continues quietly while the assistant is active.' : 'Press play to listen. Closing this player stops the music.'}</p>
              {youtube ? (
                <>
                  <div ref={containerRef} />
                  {error ? <p role="alert">{error}</p> : !ready && <p>Loading music player…</p>}
                  <label className="music-volume">
                    Music volume
                    <input type="range" min="0" max="100" value={volume} disabled={!ready} onChange={(event) => {
                      const next = Number(event.target.value)
                      baselineRef.current = next
                      setVolume(next)
                    }} />
                  </label>
                </>
              ) : (
                <>
                  <iframe title="Streaming music player" src={src} allow="encrypted-media; fullscreen; picture-in-picture" />
                  <p>Automatic volume ducking is available with the YouTube player only.</p>
                </>
              )}
              <a href={currentSongUrl} target="_blank" rel="noopener noreferrer">Open on streaming service</a>
            </>
          )}
        </div>
      )}
    </section>
  )
}
