global fullWidth
set fullWidth to 800

global baseURL
set baseURL to "http://faviconic:8000/pong.html?"

on makeWindow(x, y, width, height, numTabs, windowNum, maxWindows)
	tell application "Google Chrome"
		-- Create a new window
		make new window
		
		-- Get a reference to the window we just created
		set newWindow to front window

                delay 0.1

		tell application "System Events"
			tell process "Google Chrome"
				click menu item "Close Other Tabs" of menu "Tab" of menu bar 1
			end tell
		end tell

		--tell newWindow
			--set numExtraTabs to (count of tabs) - 1
			--repeat numExtraTabs times
                                --do shell script "echo close " & numExtraTabs
				--close tab 2 -- Always close the second tab, as the list shifts when we close one
			--end repeat
		--end tell

		-- Set the window bounds (x, y, width, height)
		set bounds of newWindow to {x, y, x + width, y + height}

                global tabCount
                set tabCount to 0

                tell newWindow
                    set URL of active tab to baseURL & "windowIndex=" & windowNum & "&tabIndex=" & tabCount
                end tell
                set tabCount to (tabCount + 1)
		
		-- Create the specified number of tabs
		repeat (numTabs - 1) times
			tell newWindow
                            if windowNum is (maxWindows - 1) and tabCount is (numTabs - 1) then
				make new tab with properties {URL:baseUrl & "windowIndex=" & windowNum & "&tabIndex=" & tabCount & "&isMain=true&numWindows=" & maxWindows & "&numTabs=" & numTabs & "&fullWidth=" & fullWidth}
                            else
				make new tab with properties {URL:baseURL & "windowIndex=" & windowNum & "&tabIndex=" & tabCount}
                            end if
			end tell
                        set tabCount to (tabCount + 1)
		end repeat
	end tell
end makeWindow

global maxWindows
set maxWindows to 8

repeat with i from 0 to (maxWindows - 1)
    my makeWindow(300, 100 + 8+(i+1)*30, fullWidth, 86+30*maxWindows-13, 30, i, maxWindows)
    delay 0.1
end repeat
