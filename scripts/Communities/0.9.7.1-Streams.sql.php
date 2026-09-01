<?php
function Communities_0_9_7_1_Streams()
{
	// Create Streams/task/ template and access
	$labels = Q_Config::get("Communities", "tasks", "admins", array());

	// add template and access for each label in the main community
	Streams::saveTemplate('Streams/task', '', array(), $labels);
}

Communities_0_9_7_1_Streams();