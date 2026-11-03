const NoticeBoard = () => {
	return (
		<div className="notice-board">
			<span className="notice-icon">📢</span>
			<p className="notice-text">
				<span className="notice-label">Check out my new game:</span>
				<a
					href="https://teqgame.softwaredesign.ing/"
					target="_blank"
					rel="noopener noreferrer"
				>
					TEQ: That Escalated Quickly
				</a>
			</p>
		</div>
	);
};

export default NoticeBoard;
