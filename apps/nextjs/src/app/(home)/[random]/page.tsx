"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardPage from "../dashboard/page";
import VehiclePage from "../vehicle_assignment/page";
import TeamAssignment from "../team_assignment/page";
import OperationalReports from "../reports/page";
import LocationsPage from "../locations/page";
import ChangePhonePage from "../account/change-phone/page";
import LogoutPage from "../logout/page";

export default function RandomPage() {
    const { random } = useParams();
    const [label, setLabel] = useState("");

    useEffect(() => {
        const storedLabel = localStorage.getItem("sidebarLabel");
        if (storedLabel) {
            setLabel(storedLabel);
        }
    }, []);

    // Render different content based on label
    const renderContent = () => {
        switch (label) {
            case "Dashboard":
                return <DashboardPage />;
            case "Vehicle assignment":
                return <VehiclePage />
            case "Team assignment":
                return <TeamAssignment />;

            case "Reports":
                return <OperationalReports />

            case "Locations":
                return <LocationsPage />;

            default:
                return <DashboardPage />;
        }
    };

    return (
        <div>{renderContent()}</div>
    );
}
