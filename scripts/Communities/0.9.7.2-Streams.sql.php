<?php
function Communities_0_9_7_2_Streams()
{
	$admins = Q_Config::get("Communities", "community", "admins", array());
	foreach ($admins as $admin) {
		$access = new Streams_Access();
		$access->publisherId = "";
		$access->streamName = "Streams/community/about";
		$access->ofContactLabel = $admin;
		if (!$access->retrieve()) {
			$access->writeLevel = 40;
			$access->adminLevel = 40;
			$access->save();
		}
	}
}

Communities_0_9_7_2_Streams();