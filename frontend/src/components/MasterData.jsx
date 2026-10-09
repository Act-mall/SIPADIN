import React, { useState } from "react";
import { AppLayout } from "./AppLayout";
import { Building, Users, Layers, FileText, MapPin, Briefcase, Plus } from "lucide-react";
import PegawaiTab from "./master/PegawaiTab";
import SubbagianTab from "./master/SubbagianTab";
import PejabatTab from "./master/PejabatTab";
import KlasifikasiTab from "./master/KlasifikasiTab";
import NaskahTab from "./master/NaskahTab";
import WilayahTab from "./master/WilayahTab";

const TABS = [
  { id: "pegawai", label: "Pegawai", icon: Users, addLabel: "Tambah Pegawai" },
  { id: "subbagian", label: "Subbagian", icon: Building, addLabel: "Tambah Subbagian" },
  { id: "pejabat", label: "Pejabat", icon: Briefcase, addLabel: "Tambah Pejabat" },
  { id: "klasifikasi", label: "Klasifikasi Arsip", icon: Layers, addLabel: "Tambah Klasifikasi" },
  { id: "naskah", label: "Jenis Naskah", icon: FileText, addLabel: "Tambah Jenis Naskah" },
  { id: "wilayah", label: "Kode Wilayah", icon: MapPin, addLabel: "Tambah Kode Wilayah" },
];

export default function MasterData() {
  const [activeTab, setActiveTab] = useState("pegawai");
  const [showAddModal, setShowAddModal] = useState(false);

  const tabConf = TABS.find((t) => t.id === activeTab);

  const commonProps = {
    isTabActive: true,
    showAddModal,
    setShowAddModal,
  };

  return (
    <AppLayout activePage="master-data">
      <div data-testid="master-data-container" className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 mb-1">
              Admin Area Exclusive
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Master Data</h1>
            <p className="text-sm text-slate-500">
              Pengelolaan referensi pegawai, subbagian, pejabat, klasifikasi arsip, jenis naskah, dan wilayah.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              data-testid={`btn-tambah-${activeTab}`}
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-red-900 hover:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {tabConf.addLabel}
            </button>
          </div>
        </div>

        <div className="flex overflow-x-auto space-x-2 border-b border-slate-200 pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`tab-master-${tab.id}`}
                onClick={() => { setActiveTab(tab.id); setShowAddModal(false); }}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-red-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mr-1.5 ${isActive ? "text-white" : "text-slate-500"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "pegawai" && <PegawaiTab {...commonProps} />}
        {activeTab === "subbagian" && <SubbagianTab {...commonProps} />}
        {activeTab === "pejabat" && <PejabatTab {...commonProps} />}
        {activeTab === "klasifikasi" && <KlasifikasiTab {...commonProps} />}
        {activeTab === "naskah" && <NaskahTab {...commonProps} />}
        {activeTab === "wilayah" && <WilayahTab {...commonProps} />}
      </div>
    </AppLayout>
  );
}
