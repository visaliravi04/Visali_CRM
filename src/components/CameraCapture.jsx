import React, { useEffect, useRef, useState } from 'react'

/** Full-screen live camera preview. Asks for camera permission itself
 * (via getUserMedia) rather than handing off to the OS camera app, so the
 * shop sees the browser's own access prompt before anything is captured. */
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('This browser can\'t open the camera here (it needs a secure https:// connection).')
      return
    }
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(e => setErr(
        e.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow camera access for this site in your browser settings and try again.'
          : 'Could not open the camera on this device.'
      ))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => { if (blob) onCapture(blob) }, 'image/jpeg', 0.9)
  }

  return (
    <div className="camera-backdrop" onClick={onClose}>
      <div className="camera-modal" onClick={e => e.stopPropagation()}>
        {err ? (
          <div className="camera-error">
            <p className="err">{err}</p>
            <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay
              onLoadedMetadata={() => setReady(true)}
              className="camera-video" />
            <div className="camera-actions">
              <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-primary" onClick={capture} disabled={!ready}>
                Capture
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
