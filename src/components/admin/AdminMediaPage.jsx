import MediaModeration from '@/components/ops/MediaModeration'

export default function AdminMediaPage({ setToast }) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Campus media</div>
          <h1>Gallery moderation</h1>
          <p>
            Hide or restore event photos and videos on the public gallery. Organizers can also
            moderate from Attendees → Gallery upload.
          </p>
        </div>
      </div>
      <MediaModeration setToast={setToast} title="All uploaded media" />
    </>
  )
}
