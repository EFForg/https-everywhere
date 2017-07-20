<ruleset name="nexusmods.com">
<target host="www.nexusmods.com" />
<target host="filedelivery.nexusmods.com" />
<rule from="^http:" to="https:" />
</ruleset>
