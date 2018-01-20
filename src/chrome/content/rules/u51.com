<ruleset name="u51.com">
	<target host="u51.com" />
	<target host="www.u51.com" />
	<target host="credit.u51.com" />
	<target host="img.credit.u51.com" />
	<target host="pic.u51.com" />
	<target host="web.u51.com" />

	<rule from="^http://u51\.com/" to="https://www.u51.com/" />

	<rule from="^http://img\.credit\.u51\.com/" to="https://credit.u51.com/" />
		<test url="http://img.credit.u51.com/uploads/post/160325/6d/ca5191442e64302f9006789394f640.png" />

	<rule from="^http:" to="https:" />
</ruleset>
