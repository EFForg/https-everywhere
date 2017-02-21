<ruleset name="keepkey.com">
	<target host="keepkey.com" />
	<target host="www.keepkey.com" />

	<rule from="^http:" to="https:" />
</ruleset>
