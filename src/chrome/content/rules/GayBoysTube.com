<!--
  GayBoysTube.com has both a wildcard DNS record and a wildcard certificate.
-->

<ruleset name="GayBoysTube.com">
	<target host="gayboystube.com" />
	<target host="*.gayboystube.com" />

	<securecookie host=".+" name=".+" />

	<rule from="^http:" to="https:" />

	<test url="http://www.gayboystube.com" />
	<test url="http://dk56oaxnvskt9fuudjab.gayboystube.com" />
	<test url="http://l6tuoj9uo8hpraum71vi.gayboystube.com" />
	<test url="http://37n7v7vwss4chwshtbwo.gayboystube.com" />
</ruleset>
