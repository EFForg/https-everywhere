<ruleset name="forum.ru-board.com">
	<target host="forum.ru-board.com" />

	<rule from="^http:" to="https:" />
</ruleset>
