<!--
	Invalid Certificate:
		dailyhadith.abuaminaelias.com
-->
<ruleset name="Abu Amina Elias.com">
	<target host="abuaminaelias.com" />
	<target host="www.abuaminaelias.com" />

	<securecookie host=".+" name=".+" />

	<rule from="^http:" to="https:" />
</ruleset>
