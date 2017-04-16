<ruleset name="ibmmainframes.com">
<target host="ibmmainframes.com" />
<target host="*.ibmmainframes.com" />
<rule from="^http:" 
      to="https:" />
</ruleset>
