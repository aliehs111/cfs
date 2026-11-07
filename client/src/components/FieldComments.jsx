import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, isAdmin, readError } from '../lib/auth'

const MAX_LENGTH = 2000

const quiet = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--off-white)',
  opacity: 0.55,
  fontSize: '0.7rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const textareaStyle = {
  width: '100%',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(236,228,215,0.2)',
  padding: '8px 0',
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: '16px', // 16px+ stops iOS from zooming into the field
  fontWeight: 300,
  color: 'var(--off-white)',
  outline: 'none',
  caretColor: 'var(--maroon)',
  resize: 'vertical',
  borderRadius: 0,
}

function timeAgo(iso) {
  if (!iso) return ''
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function FieldComments({ post, user }) {
  const [comments, setComments] = useState(post.comments || [])
  const liveCount = comments.filter((c) => !c.deleted).length
  const [open, setOpen] = useState(false)

  const topLevel = comments.filter((c) => !c.parent_id)
  const repliesTo = (id) => comments.filter((c) => c.parent_id === id)

  const added = (c) => setComments((prev) => [...prev, c])
  const replaced = (c) => setComments((prev) => prev.map((x) => (x.id === c.id ? c : x)))
  const removed = (id) =>
    setComments((prev) => {
      const hasReplies = prev.some((x) => x.parent_id === id && !x.deleted)
      return hasReplies
        ? prev.map((x) => (x.id === id ? { ...x, deleted: true, body: null, author: null, user_id: null } : x))
        : prev.filter((x) => x.id !== id && x.parent_id !== id)
    })

  const label = liveCount ? `${liveCount} comment${liveCount === 1 ? '' : 's'}` : user ? 'Comment' : null

  return (
    <div style={{ marginTop: '1rem' }}>
      {label && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={quiet}>
          {open ? 'Hide comments' : label}
        </button>
      )}
      {!label && (
        <Link to="/login?next=/in-the-field" style={{ ...quiet, textDecoration: 'none' }}>
          Sign in to comment
        </Link>
      )}

      {open && (
        <div style={{ marginTop: '1rem' }}>
          {topLevel.map((c) => (
            <div key={c.id} style={{ marginBottom: '1rem' }}>
              <Comment comment={c} user={user} onChange={replaced} onRemoved={removed} onReply={added} canReply />
              {repliesTo(c.id).length > 0 && (
                <div style={{ marginLeft: '1rem', paddingLeft: '0.9rem', borderLeft: '1px solid rgba(236,228,215,0.12)' }}>
                  {repliesTo(c.id).map((r) => (
                    <Comment key={r.id} comment={r} user={user} onChange={replaced} onRemoved={removed} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {user ? (
            <Composer postId={post.id} onPosted={added} placeholder="Add a comment" />
          ) : (
            <Link to="/login?next=/in-the-field" style={{ ...quiet, textDecoration: 'none' }}>
              Sign in to comment
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function Comment({ comment, user, onChange, onRemoved, onReply, canReply }) {
  const [editing, setEditing] = useState(false)
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState('')

  if (comment.deleted) {
    return (
      <p style={{ fontSize: '0.8rem', opacity: 0.55, fontStyle: 'italic', margin: '0.5rem 0' }}>Comment removed</p>
    )
  }

  const mine = user && comment.user_id === user.id
  // Authors manage their own comments; admins can edit or delete any.
  const canManage = mine || isAdmin(user)

  const remove = async () => {
    const who = mine ? 'your comment' : `${comment.author}'s comment`
    if (!window.confirm(`Delete ${who}?`)) return
    setError('')
    try {
      const res = await apiFetch(`/api/field/comments/${comment.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await readError(res, 'Could not delete.'))
      onRemoved(comment.id)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{ margin: '0.5rem 0' }}>
      <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--off-white)' }}>
        <span style={{ opacity: 0.85, fontWeight: 500 }}>{comment.author}</span>
        <span style={{ opacity: 0.55 }}>
          {' '}
          · {timeAgo(comment.created_at)}
          {comment.edited_at ? ' · edited' : ''}
        </span>
      </p>
      {editing ? (
        <Composer
          initial={comment.body}
          commentId={comment.id}
          onPosted={(c) => {
            onChange(c)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
          submitLabel="Save"
        />
      ) : (
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: '0.2rem 0 0', opacity: 0.8, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
          {comment.body}
        </p>
      )}
      {!editing && user && (
        <div className="flex gap-4" style={{ marginTop: '0.3rem' }}>
          {canReply && (
            <button type="button" onClick={() => setReplying((r) => !r)} style={quiet}>
              Reply
            </button>
          )}
          {canManage && (
            <button type="button" onClick={() => setEditing(true)} style={quiet}>
              Edit
            </button>
          )}
          {canManage && (
            <button type="button" onClick={remove} style={quiet}>
              Delete
            </button>
          )}
        </div>
      )}
      {error && <p style={{ color: 'var(--maroon-text)', fontSize: '0.75rem', margin: '0.3rem 0 0' }}>{error}</p>}
      {replying && (
        <div style={{ marginLeft: '1rem' }}>
          <Composer
            postId={comment.post_id}
            parentId={comment.id}
            placeholder={`Reply to ${comment.author}`}
            onPosted={(c) => {
              onReply(c)
              setReplying(false)
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  )
}

function Composer({ postId, parentId, commentId, initial = '', placeholder, submitLabel = 'Post', onPosted, onCancel }) {
  const [body, setBody] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = commentId
        ? await apiFetch(`/api/field/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body }) })
        : await apiFetch(`/api/field/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body, parent_id: parentId || null }),
          })
      if (res.status === 401) throw new Error('Your session ended. Sign in again to comment.')
      if (res.status === 429) throw new Error("You've commented a lot this hour. Try again later.")
      if (!res.ok) throw new Error(await readError(res, 'Could not post that.'))
      const { comment } = await res.json()
      setBody('')
      onPosted(comment)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: '0.6rem' }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={MAX_LENGTH}
        placeholder={placeholder}
        aria-label={placeholder || 'Edit comment'}
        disabled={busy}
        style={textareaStyle}
      />
      {error && <p style={{ color: 'var(--maroon-text)', fontSize: '0.75rem', margin: '0.3rem 0 0' }}>{error}</p>}
      <div className="flex gap-4" style={{ marginTop: '0.5rem' }}>
        <button type="submit" disabled={busy || !body.trim()} style={{ ...quiet, opacity: busy || !body.trim() ? 0.3 : 0.9 }}>
          {busy ? 'Posting…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={quiet}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
