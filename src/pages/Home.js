// src/page/Home.js
import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Home.module.css"

function Home() {
    const navigate = useNavigate();

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>ヤニブオンライン</h2>
            <div className={styles.buttons}>
                <button onClick={() => navigate("/create")} className={styles.button}>
                    ルームを作成
                </button>
                <button onClick={() => navigate("/join")} className={styles.button}>
                    ルームに参加
                </button>
            </div>
        </div>
    );
}

export default Home;