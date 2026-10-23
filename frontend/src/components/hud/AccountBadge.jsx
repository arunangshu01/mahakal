import './hud.css'

export default function AccountBadge({ user, guest, onSignIn, onOpenAccount }) {
  if (user) {
    return (
      <button type="button" className="account account-open" onClick={onOpenAccount} aria-label={`Account: ${user.name}`}>
        {user.picture ? (
          <img className="account-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="account-avatar account-initial">{user.name.charAt(0)}</span>
        )}
        <span className="account-name">{user.name.split(' ')[0].toUpperCase()}</span>
      </button>
    )
  }
  if (guest) {
    return (
      <div className="account">
        <span className={`account-guest ${guest.remaining === 0 ? 'empty' : ''}`}>
          GUEST · {guest.remaining}/{guest.limit}
        </span>
        <button type="button" className="account-button primary" onClick={onSignIn}>
          SIGN IN
        </button>
      </div>
    )
  }
  return null
}
