import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import MusicPlayer from './MusicPlayer'

const songUrl = 'https://music.youtube.com/watch?v=STq6tE6un6E&si=tracking'
let players
let user

beforeEach(() => {
  vi.useFakeTimers()
  user = { click: (element) => act(async () => { fireEvent.click(element) }) }
  players = []
  vi.stubGlobal('YT', { Player: vi.fn(function (frame, options) {
    let volume = 55
    const player = {
      setVolume: vi.fn((next) => { volume = next }),
      getVolume: vi.fn(() => volume),
      getVideoData: vi.fn(() => ({ title: 'Initial song title', video_id: 'STq6tE6un6E' })),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      destroy: vi.fn(() => frame.remove()),
      options,
    }
    players.push(player)
    Promise.resolve().then(() => options.events.onReady({ target: player }))
    return player
  }) })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const fade = () => act(() => vi.advanceTimersByTime(400))

test('loads the supplied recording on demand without autoplay and stops on close', async () => {
  const { container } = render(<MusicPlayer status="idle" />)
  expect(container.querySelector('iframe')).toBeNull()
  expect(window.YT.Player).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  const frame = screen.getByTitle('YouTube music player')
  expect(frame.src).toContain('/STq6tE6un6E?autoplay=0&enablejsapi=1')
  expect(frame.src).toContain('origin=')
  expect(players[0].playVideo).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Close music' }))
  expect(players[0].destroy).toHaveBeenCalledOnce()
  expect(container.querySelector('iframe')).toBeNull()
})

test('shows the current video title and updates it when a recommendation plays', async () => {
  render(<MusicPlayer status="idle" />)
  expect(screen.queryByText('Shambhu Stuti · Ketan Kumar')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  expect(screen.getByText('Initial song title')).toBeInTheDocument()
  players[0].getVideoData.mockReturnValue({ title: 'Another song · Another artist', video_id: 'abcdefghijk' })
  act(() => players[0].options.events.onStateChange({ target: players[0], data: 1 }))
  expect(screen.getByText('Another song · Another artist')).toBeInTheDocument()
  expect(screen.queryByText('Initial song title')).toBeNull()
  expect(screen.getByRole('link', { name: 'Open on streaming service' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk')
  expect(window.YT.Player).toHaveBeenCalledOnce()
})

test('refreshes delayed metadata and uses a neutral title when metadata is missing', async () => {
  const { unmount } = render(<MusicPlayer status="idle" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  players[0].getVideoData.mockReturnValue({ video_id: 'abcdefghijk' })
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.queryByText('Initial song title')).toBeNull()
  players[0].getVideoData.mockReturnValue({ title: 'Late title', video_id: 'abcdefghijk' })
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByText('Late title')).toBeInTheDocument()
  const calls = players[0].getVideoData.mock.calls.length
  unmount()
  act(() => vi.advanceTimersByTime(2000))
  expect(players[0].getVideoData).toHaveBeenCalledTimes(calls)
})

test('closing and reopening does not retain the previous recommendation title', async () => {
  render(<MusicPlayer status="idle" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  players[0].getVideoData.mockReturnValue({ title: 'Recommended song', video_id: 'abcdefghijk' })
  act(() => players[0].options.events.onStateChange({ target: players[0], data: 1 }))
  await user.click(screen.getByRole('button', { name: 'Close music' }))
  expect(screen.queryByText('Recommended song')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  expect(screen.getByText('Initial song title')).toBeInTheDocument()
})

test('ducks without restarting or pausing the player and restores its previous volume', async () => {
  const { rerender } = render(<MusicPlayer status="idle" songUrl={songUrl} />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  fade()
  const frame = screen.getByTitle('YouTube music player')
  const player = players[0]
  player.setVolume(70)
  for (const status of ['listening', 'thinking', 'speaking']) {
    rerender(<MusicPlayer status={status} songUrl={songUrl} />)
    fade()
    expect(player.getVolume()).toBe(8)
    expect(screen.getByTitle('YouTube music player')).toBe(frame)
  }
  rerender(<MusicPlayer status="idle" songUrl={songUrl} />)
  fade()
  expect(player.getVolume()).toBe(70)
  expect(player.pauseVideo).not.toHaveBeenCalled()
  expect(player.playVideo).not.toHaveBeenCalled()
  expect(window.YT.Player).toHaveBeenCalledOnce()
})

test('overlapping notices and assistant activity keep music quiet until both finish', async () => {
  const { rerender } = render(<MusicPlayer status="idle" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  fade()
  rerender(<MusicPlayer status="idle" notificationId={1} />)
  fade()
  expect(players[0].getVolume()).toBe(8)
  rerender(<MusicPlayer status="speaking" notificationId={1} />)
  act(() => vi.advanceTimersByTime(3500))
  expect(players[0].getVolume()).toBe(8)
  rerender(<MusicPlayer status="idle" notificationId={1} />)
  fade()
  expect(players[0].getVolume()).toBe(55)
})

test('a second interruption during restoration preserves the original volume', async () => {
  const { rerender } = render(<MusicPlayer status="idle" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  fade()
  rerender(<MusicPlayer status="speaking" />)
  fade()
  rerender(<MusicPlayer status="idle" />)
  act(() => vi.advanceTimersByTime(120))
  rerender(<MusicPlayer status="listening" />)
  fade()
  rerender(<MusicPlayer status="idle" />)
  fade()
  expect(players[0].getVolume()).toBe(55)
})

test('opening during a reply starts quiet; changing volume while ducked affects restoration', async () => {
  const { rerender } = render(<MusicPlayer status="speaking" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  fade()
  expect(players[0].getVolume()).toBe(8)
  fireEvent.change(screen.getByRole('slider', { name: 'Music volume' }), { target: { value: '35' } })
  fade()
  rerender(<MusicPlayer status="idle" />)
  fade()
  expect(players[0].getVolume()).toBe(35)
})

test('shows provider playback errors and retains an external listening link', async () => {
  render(<MusicPlayer status="idle" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  act(() => players[0].options.events.onError({ data: 101 }))
  expect(screen.getByRole('alert')).toHaveTextContent('cannot play here')
  expect(screen.getByRole('link', { name: 'Open on streaming service' })).toHaveAttribute('href', expect.stringContaining('STq6tE6un6E'))
})

test('reports a blocked API script and allows retry on reopening', async () => {
  const api = window.YT
  vi.stubGlobal('YT', undefined)
  render(<MusicPlayer status="idle" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  const script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
  expect(script).not.toBeNull()
  await act(async () => { script.onerror() })
  expect(screen.getByRole('alert')).toHaveTextContent('could not load')
  await user.click(screen.getByRole('button', { name: 'Close music' }))
  vi.stubGlobal('YT', api)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  expect(players).toHaveLength(1)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('closing while the API loads does not create a late player', async () => {
  const api = window.YT
  vi.stubGlobal('YT', undefined)
  render(<MusicPlayer status="idle" />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  await user.click(screen.getByRole('button', { name: 'Close music' }))
  vi.stubGlobal('YT', api)
  await act(async () => { window.onYouTubeIframeAPIReady() })
  expect(players).toHaveLength(0)
})

test.each([
  ['https://youtu.be/abcdefghijk', 'youtube-nocookie.com'],
  ['https://open.spotify.com/track/123abc', 'open.spotify.com/embed/track/123abc'],
  ['javascript:alert(1)', null],
  ['https://evil.com/watch?v=abcdefghijk', null],
  ['http://youtube.com/watch?v=abcdefghijk', null],
  ['', null],
])('validates streaming URL %s', async (url, expected) => {
  const { container } = render(<MusicPlayer status="idle" songUrl={url} />)
  await user.click(screen.getByRole('button', { name: 'Listen to music' }))
  const frame = container.querySelector('iframe')
  if (expected) expect(frame.src).toContain(expected)
  else expect(frame).toBeNull()
})
