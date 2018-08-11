<ruleset name="nxp.com">

	<target host="nxp.com" />


	<rule from="^http:"
		to="https:" />

</ruleset>
