<ruleset name="LowEndBox.com">
	<target host="lowendbox.com" />
	<target host="www.lowendbox.com" />
	<target host="helpdesk.lowendbox.com" />
	<target host="register.lowendbox.com" />
	<target host="wiki.lowendbox.com" />

	<target host="lowendtalk.com" />
	<target host="www.lowendtalk.com" />

	<securecookie host=".+" name=".+" />

	<rule from="^http:" to="https:" />
</ruleset>
