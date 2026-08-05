/* ============================================================
   Shared Manual EFT proof-of-payment widget.
   Used by checkout.html (immediate, guest-friendly upload right after
   placing an order), checkout-success.html, and the customer account
   order-detail page. One implementation, one behavior everywhere.
   ============================================================ */

const STATUS_COPY = {
  PENDING_PROOF: { label: 'Awaiting your payment', tone: 'neutral' },
  PROOF_UPLOADED: { label: 'Awaiting verification', tone: 'warning' },
  VERIFIED: { label: 'Payment verified', tone: 'success' },
  REJECTED: { label: 'Payment not verified — please re-upload', tone: 'error' },
}

// `uploadFn` is injected so this widget works with either the public,
// order-UUID-scoped upload (uploadEftProof) or the authenticated,
// ownership-checked customer upload (uploadMyOrderProof) — same UI either way.
export function renderEftProofWidget(container, { orderId, eftVerificationStatus, rejectionReason, uploadFn, onUploaded }) {
  const status = STATUS_COPY[eftVerificationStatus] || STATUS_COPY.PENDING_PROOF
  const canUpload = eftVerificationStatus !== 'VERIFIED'

  container.innerHTML = `
    <div class="eft-proof-widget">
      <div class="eft-proof-status eft-proof-status--${status.tone}">${status.label}</div>
      ${rejectionReason ? `<p class="eft-proof-reason">${rejectionReason}</p>` : ''}
      ${canUpload ? `
        <label class="eft-proof-dropzone" tabindex="0">
          <input type="file" accept="image/jpeg,image/png,application/pdf" class="eft-proof-input" style="display:none;" capture="environment">
          <span class="eft-proof-dropzone-text">Drag &amp; drop your proof of payment, or click to choose a file</span>
        </label>
        <p class="eft-proof-hint">JPG, PNG, or PDF</p>
        <p class="eft-proof-filename" style="display:none;"></p>
      ` : ''}
    </div>
  `

  if (!canUpload) return

  const dropzone = container.querySelector('.eft-proof-dropzone')
  const input = container.querySelector('.eft-proof-input')
  const filenameEl = container.querySelector('.eft-proof-filename')

  async function handleFile(file) {
    if (!file) return
    dropzone.classList.add('eft-proof-dropzone--uploading')
    try {
      const result = await uploadFn(orderId, file)
      if (filenameEl) {
        filenameEl.textContent = `Uploaded: ${file.name}`
        filenameEl.style.display = 'block'
      }
      onUploaded?.(result.eftVerificationStatus)
    } catch (err) {
      alert(err.message || 'Upload failed. Please try again.')
    } finally {
      dropzone.classList.remove('eft-proof-dropzone--uploading')
    }
  }

  input.addEventListener('change', () => handleFile(input.files[0]))
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click() }
  })
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('eft-proof-dropzone--drag') })
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('eft-proof-dropzone--drag'))
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.classList.remove('eft-proof-dropzone--drag')
    handleFile(e.dataTransfer.files[0])
  })
}
